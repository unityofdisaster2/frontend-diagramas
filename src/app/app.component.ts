import { OnInit, Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { dia, ui, shapes, setTheme, g, linkTools, util } from '@clientio/rappid';
import { MongoService } from './services/mongo.service';
import { RappidOPMUtils, OPDNode, InOutStructure } from './utils/rappid-opm-utils';
import { saveAs } from 'file-saver';
import * as alertify from 'alertifyjs';
import { opm, shapeConfig } from './utils/custom-shapes';
import { DialogoComponent } from './components/dialogo/dialogo.component';
import { MatDialog } from '@angular/material/dialog';
import { cloneDeep, isString } from 'lodash';

import { TreeViewComponent } from './components/tree-view/tree-view.component';
import { DialogoSaveComponent } from './components/dialogo-save/dialogo-save.component';
import { StencilService } from './services/stencil.service';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {

  // referencia a los contenedores que se encuentran en el html
  @ViewChild('paperContainer') canvas: ElementRef;
  @ViewChild('stencilContainer') stencilContainer: ElementRef;
  @ViewChild('stencilDB') stencilDBContainer: ElementRef;
  @ViewChild('toolbarContainer') toolbarContainer: ElementRef;
  @ViewChild(TreeViewComponent) treeViewChild: TreeViewComponent;

  // declaracion de componentes de la clase

  private currentGraph: dia.Graph;
  private tempGraph: dia.Graph;
  private keyboard: ui.Keyboard;
  private paper: dia.Paper;
  private scroller: ui.PaperScroller;
  private stencil: ui.Stencil;
  private stencilDB: ui.Stencil;
  private toolbar: ui.Toolbar;
  OPDTree: OPDNode[] = [];
  currentID: string;
  private dbObjects: Array<shapes.standard.Image> = [];
  private objectMaps: any = {};
  private globalInspector: ui.Inspector;

  constructor(private mongo: MongoService,
    public dialog: MatDialog,
    public stencilServ: StencilService) { }

  /**
   * funcion utilizada para llamar una ventana de dialogo para agregar puertos
   * de entrada o salida a un elemento (objecto o proceso)
   * @param elemento modelo del elemento
   */
  openMatDialog(elemento: any) {
    // se abre la ventana de dialogo y se guarda la referencia en una variable
    const dialogRef = this.dialog.open(DialogoComponent);
    // por medio de la referencia se suscribe al objeto parentCOM para
    // estar pendiente cuando emita un evento
    dialogRef.componentInstance.parentCOM.subscribe(() => {
      let group: string;

      // si el valor de tipo es 0 se considera entrada
      if (dialogRef.componentInstance.tipo === '0') {
        group = 'in';
        elemento.model.addInPort(dialogRef.componentInstance.nombre);
        elemento.model.prop(`inputs/${dialogRef.componentInstance.nombre}`, {});
        elemento.model.prop(`inputs/${dialogRef.componentInstance.nombre}/from`, []);
        elemento.model.prop(`inputs/${dialogRef.componentInstance.nombre}/to`, []);
        elemento.model.prop(`inputs/${dialogRef.componentInstance.nombre}/values`, []);

      }
      // si el valor de tipo es 1 se considera salida
      else if (dialogRef.componentInstance.tipo === '1') {
        group = 'out';
        elemento.model.addOutPort(dialogRef.componentInstance.nombre);

        elemento.model.prop(`outputs/${dialogRef.componentInstance.nombre}`, {});
        elemento.model.prop(`outputs/${dialogRef.componentInstance.nombre}/values`, []);
        elemento.model.prop(`outputs/${dialogRef.componentInstance.nombre}/from`, []);
        elemento.model.prop(`outputs/${dialogRef.componentInstance.nombre}/to`, []);

      }
      this.updateChildPorts(elemento.model.id, dialogRef.componentInstance.nombre, group);


      if (dialogRef.componentInstance.closed) {
        dialogRef.close();
      }
    });

  }
  /**
   * funcion utilizada para manejar el evento de guardado en la base de datos
   * utilizando como apoyo una ventana de dialogo
   * @param paper referencia del paper de jointjs
   * @param stencil referencia del stencil que refleja los registros de la base de datos
   */
  openSaveDialog(paper: dia.Paper, stencil: ui.Stencil) {
    // se abre la ventana de dialogo y se guarda la referencia en una variable
    const dialogRef = this.dialog.open(DialogoSaveComponent);
    // por medio de la referencia se suscribe al objeto parentCOM para
    // estar pendiente cuando emita un evento
    dialogRef.componentInstance.parentCOM.subscribe(() => {
      // se capturan los datos obtenidos en la ventana de dialogo 
      const tipo = dialogRef.componentInstance.seleccionado;
      const nombre = dialogRef.componentInstance.nombre;

      // se llama funcion to PNG para crear una imagen con el contenido
      // actual del diagrama
      paper.toPNG((imgData) => {
        // se guarda grafo en base de datos y se actualiza el stencil
        const nodoActual = this.searchNode(this.OPDTree, this.currentID);
        nodoActual.jsonGraph = this.currentGraph.toJSON();
        this.mongo.insertGraph(this.OPDTree, imgData, tipo, nombre).subscribe((data) => {
          this.dbObjects = [];
          this.objectMaps = {};
          this.updateStencilDB(stencil);

          alertify.success('diagrama guardado en servidor');
        }, (err) => {
          alertify.error('no se pudo establecer conexion con la base de datos');
        });
      });

      if (dialogRef.componentInstance.closed) {
        dialogRef.close();
      }
    });

  }


  /**
   * funcion utiizada para crear un arreglo de objetos conforme al numero
   * de parametros que tenga un elemento 'opm.object' (utilizado principalmente para 
   * convertir los parametros en objetos 'hijo')
   * @param el modelo del elemento seleccionado
   * @returns arreglo de objetos
   */
  createObjectArray(el: dia.ElementView): Array<shapes.devs.Atomic> {
    const arreglo: Array<shapes.devs.Atomic> = [];
    // se verifica la existencia del atributo parametros. En caso de
    // encontrarlo se itera sobre las entradas de su arreglo

    if (el.model.get('parametros')) {
      // entries genera un iterador con los pares clave/valor, para los indices del array
      // por ello se toma el segundo y es el que se asigna a los parametros del objeto temporal      
      for (const params of el.model.get('parametros').entries()) {

        const tempObj = new opm.Object() as shapes.devs.Atomic;

        tempObj.prop('parametros', [params[1]]);
        tempObj.prop('staticParams', {});
        tempObj.get('staticParams').objectSubtype = 'requirement';
        // tempObj.attributes.staticParams.objectSubtype = 'requirement';
        // se pone al objeto temporal el nombre del parametro seleccionado
        tempObj.attr('.label/text', params[1].name);

        arreglo.push(tempObj);
      }
    }

    return arreglo;
  }

  /**
   * funcion utilizada para realizar la busqueda del nodo de un arbol por medio
   * de un id
   * @param tree estructura de arbol que sera recorrido
   * @param id identificador del nodo que se busca
   * @returns regresa el nodo si lo encuentra, de lo contrario se devuelve undefined
   */
  searchNode(tree: OPDNode[], id: string): OPDNode {
    for (const element of tree) {
      if (element.id === id) {
        return element;
      } else if (element.children) {
        return this.searchNode(element.children, id);
      }
    }
  }

  /**
   * Funcion utilizada para cambiar la vista del diagrama actual por la de otro
   * nodo seleccionado en la jerarquia treeView (esta funcion esta ligada a treeView por medio de un @Output)
   * @param $event nodo que ha sido seleccionado del OPDTree
   */
  changeGraphView($event: OPDNode) {
    // se verifica que el id seleccionado en la jerarquia no corresponda al id actual
    if (this.currentID === $event.id) {
      alertify.warning('se esta seleccionando la misma vista');
    } else {

      const currentNode = this.searchNode(this.OPDTree, this.currentID);
      // antes de cambiar de vista se guarda el grafo del diagrama en el nodo actual 
      currentNode.jsonGraph = this.currentGraph.toJSON();
      const nodo = this.searchNode(this.OPDTree, $event.id);

      // se carga el grafo del nodo seleccionado
      this.currentGraph.clear();
      this.currentGraph.fromJSON(nodo.jsonGraph);

      this.currentID = $event.id;
      // se actualizan los puertos del nodo padre 
      this.updateParentPorts(this.currentGraph);
    }
  }

  /**
   * funcion utilizada para actualizar los puertos de elementos hijos cada que se agrega
   * uno nuevo en el padre
   * @param elementID ID del elemento al que se estan agregando puertos
   * @param portID nombre del puerto que se agrega
   * @param group grupo correspondiente al puerto (in | out)
   */
  updateChildPorts(elementID: string, portID: string, group: string) {
    // se busca el nodo hijo
    const tempNode = this.searchNode(this.OPDTree, elementID);
    if (tempNode) {
      // se crea un grafo temporal para extraer el contenido del diagrama del nodo hijo
      const tempGraph = new dia.Graph({}, { cellNamespace: { opm, shapes } }).fromJSON(tempNode.jsonGraph);
      const cells = tempGraph.getCells();
      // se itera sobre las celdas y se busca al objeto que heredara el puerto
      for (const cell of cells.entries()) {
        if (cell[1].attributes.type === 'opm.ChildObject') {
          const childElement = cell[1] as shapes.devs.Model;
          if (group === 'in') {
            childElement.addInPort(portID);
          } else if (group === 'out') {
            childElement.addOutPort(portID);
          }
          tempNode.jsonGraph = tempGraph.toJSON();
          break;
        }
      }
    }
  }


  /**
   * funcion utilizada para actualizar los puertos y asociar los puertos que se hayan creado
   * en un objeto hijo con los del padre
   * @param graph grafo que contiene el diagrama de la vista actual
   */
  updateParentPorts(graph: dia.Graph) {
    // se obtienen la celdas del grafo actual y se recorren
    const tempCells = graph.getCells();
    tempCells.forEach((cell: dia.Cell) => {
      // solo se toma en cuenta las celdas que son elementos
      if (cell.isElement()) {

        // se hace un casteo para tomar la celda como Model
        const element = cell as shapes.devs.Model;
        const puertos = element.getPorts();
        // se verifica si la celda tiene puertos
        if (puertos.length > 0) {
          // se puede cambiar el tree por nodo actual para que sea menor el recorrido
          const tempNode = this.searchNode(this.OPDTree, element.id.toString());
          // se verifica si existe un nodo hijo con el id del elemento
          if (tempNode) {
            // creacion de grafo temporal para interactuar con el contenido del nodo hijo
            const tempGraph = new dia.Graph({}, { cellNamespace: { opm, shapes } }).fromJSON(tempNode.jsonGraph);
            // se obtienen las celdas del nodo hijo y se itera sobre ellas
            const tempGraphCells = tempGraph.getCells();
            for (const tempCell of tempGraphCells.entries()) {

              // solo se toma en cuenta la celda que sea parent, es decir la que esta
              // relacionada con el elemento que tiene in zoom
              if (tempCell[1].attributes.type === 'opm.ChildObject') {
                const modelCell = tempCell[1] as shapes.devs.Model;

                // se obtienen los puertos de la celda
                const childPorts = modelCell.getPorts();
                let flag = false;
                // se verifica si el hijo tiene mas puertos
                if (childPorts.length > puertos.length) {
                  // se itera sobre los puertos del elemento hijo y se verifica
                  // si algun puerto no se encuentra en el elemento padre
                  childPorts.forEach((p) => {
                    flag = false;
                    for (const val of puertos.entries()) {
                      if (p.id === val[1].id) {
                        flag = true;
                        break;
                      }
                    }
                    if (!flag) {
                      if (p.group === 'in') {
                        element.addInPort(p.id);
                      } else if (p.group === 'out') {
                        element.addOutPort(p.id);
                      }
                    }
                  });
                }
                break;
              }
            }
          }
        }
      }
    });



  }

  initTree() {
    this.OPDTree = [];
    this.OPDTree.push({
      name: 'root',
      id: 'root',
      type: 'root',
      jsonGraph: undefined,
      level: 0,
    });
    this.currentID = 'root';
  }

  portBelongsToGroup(elementModel: shapes.devs.Model, portID: string, portGroup: string) {
    const filteredPort = elementModel.getGroupPorts(portGroup).filter((elementPort) => elementPort.id === portID).pop();
    if (filteredPort) {
      return true;
    } else {
      return false;
    }
  }



  public ngOnInit(): void {



    // objeto que contiene todas las definiciones de OPM
    const utils = new RappidOPMUtils();



    // tema de rappid
    setTheme('modern');
    // objeto que contendra toda la estructura del grafo generado en el diagrama
    this.currentGraph = new dia.Graph({}, {
      // se debe especificar el namespace de shapes para que reconozca las figuras
      // personalizadas
      // cellNamespace: shapes
      cellNamespace: { opm, shapes }
    });

    // objeto que contendra toda la estructura del grafo generado en el diagrama


    this.initTree();









    // objeto utilizado para capturar eventos de teclado
    const keyboard = this.keyboard = new ui.Keyboard();

    // declaracion de lienzo que contendra los elementos de diagrama
    const paper = this.paper = new dia.Paper({
      gridSize: 10,
      drawGrid: {
        name: 'mesh'
      },
      model: this.currentGraph,
      defaultLink: (elementView, magnet) => {

        // se utiliza como link por defecto el de resultado consumo de OPM
        return new opm.tempLink();
      },
      // con esta opcion los links forzosamente deben tener un origen y destino
      linkPinning: false,
      async: true,
      // opcion para evitar que se agrupen elementos al sobreponerlos
      embeddingMode: true,
      cellViewNamespace: { opm, shapes }
    });



    // objeto que permite seleccionar elementos de maneras personalizadas
    const selection = new ui.Selection({
      paper,
      graph: this.currentGraph
    });



    // se declara variable celda que contendra el "estado" de un elemento
    // del diagrama cuando sea presionado
    let celda: any;


    paper.on({
      // evento para poder mover el lienzo mediante un drag del cursor
      'blank:pointerdown': (evt, x, y) => {
        if (keyboard.isActive('shift', evt)) {
          selection.startSelecting(evt);
        } else {
          selection.cancelSelection();
          scroller.startPanning(evt);
        }
        // al activarse este evento se esconden las toolViews de los links que
        // se encuentran activas
        paper.hideTools();
        if (this.globalInspector) {
          this.globalInspector.remove();
        }

        // si se presiona en cualquier parte del lienzo que no sea un elemento
        // del diagrama se desactiva el estado
        celda = null;
      },


      // evento que escucha cuando se presiona el puntero sobre un elemento
      'element:pointerdown': (elementView, evt) => {
        // se guarda el modelo del elemento activo al dar click
        celda = elementView.model;
        // se guarda la posicion del elemento
        evt.data = elementView.model.position();
      },
      // evento que escucha cuando se suelta el puntero sobre un elemento
      'element:pointerup': (elementView, evt, x, y) => {
        // se obtienen las coordenadas del sitio donde se solto el puntero
        const coordenadas = new g.Point(x, y);
        // se toma el modelo del elemento que haya sido arrastrado
        const elementoSuperior = elementView.model;
        // se busca si hay un elemento debajo del que se ha arrastrado
        const elementoInferior = this.currentGraph.findModelsFromPoint(coordenadas).find((el => {
          return (el.id !== elementoSuperior.id);
        }));

        // si existe un elemento debajo se retorna el elemento superior a su posicion original
        if (elementoInferior) {
          elementoInferior.embed(elementoSuperior);
          // console.log(this.graphContainer);
        }
      },


      // evento que escucha cuando el mouse esta sobre un elemento
      'element:mouseover': (elementView, evt) => {
        // se genera un efecto de opacidad
        elementView.model.attr('body/opacity', 0.7);
      },
      // evento que escucha cuando el mouse sale del rango donde se encuentra un elemento
      'element:mouseout': (cellView, evt) => {
        // se elimina efecto de opacidad
        cellView.model.attr('body/opacity', 'none');
      },

      // menu contextual sobre un elemento (click derecho)
      'element:contextmenu': (elementView, evt) => {
        // se utiliza el componente para mostrar menu personalizado con dos opciones


        const ct = new ui.ContextToolbar({
          tools: [
            { action: 'add_port', content: 'agregar puerto' },
            { action: 'inzoom', content: 'in zoom' }
          ],
          // se renderiza el menu a un lado del elemento que haya sido presionado
          target: elementView.el,
          autoClose: true,
        });

        ct.render();

        // accion ejecutada al presionar el boton add_port
        ct.on('action:add_port', () => {
          // se remueve el menu contextual para evitar crear dialogos indefinidamente
          ct.remove();
          this.openMatDialog(elementView);
        });
        // accion ejecutada al presionar boton zoom
        ct.on('action:inzoom', () => {
          ct.remove();
          const nodoExistente = this.searchNode(this.OPDTree, elementView.model.id);
          if (nodoExistente) {
            this.changeGraphView(nodoExistente);
            return;
          }
          if (elementView.model.attributes.type === 'opm.ChildObject') {
            alertify.warning('ya se encuentra en esta vista');
            return;
          }
          // se busca el nodo actual para guardar el estado del grafo
          const nodoActual = this.searchNode(this.OPDTree, this.currentID);
          if (nodoActual.children === undefined) {
            nodoActual.children = [];
          }
          elementView.model.prop('isParent', true);
          nodoActual.jsonGraph = this.currentGraph.toJSON();

          // se crea nodo hijo con los valores del objeto seleccionado
          nodoActual.children.push({
            // se selecciona el nombre del objeto
            name: elementView.model.attr('.label/text'),
            // name: elementView.model.attributes.attrs['.label'].text,
            // se utiliza como id el generado automaticamente por el framework
            id: elementView.model.id,

            type: elementView.model.attributes.type,
            level: nodoActual.level + 1
          });
          this.currentID = elementView.model.id;

          // se actualiza el contenido del arbol en la vista
          this.treeViewChild.updateTree(this.OPDTree);
          // se crea un arreglo de objetos conforme a los parametros del elemento
          const arreglo = this.createObjectArray(elementView) as Array<shapes.devs.Atomic>;

          const padre = new opm.ChildObject() as shapes.devs.Coupled;

          padre.resize(600, 600);

          // se agrega la posibilidad de crear puertos en objeto padre
          padre.changeInGroup(shapeConfig.inPortProps);
          padre.changeOutGroup(shapeConfig.outPortProps);
          padre.prop('inputs', {});
          padre.prop('outputs', {});
          padre.prop('parentID', elementView.model.id);
          // se traspasan los puertos de la figura original a la in zoomed
          const portArray = elementView.model.getPorts() as Array<dia.Element.Port>;
          portArray.forEach((port) => {
            if (port.group === 'in') {
              padre.addInPort(port.id);
              padre.prop(`inputs/${port.id}`, {});
              padre.prop(`inputs/${port.id}/values`, []);
              padre.prop(`inputs/${port.id}/from`, []);
              padre.prop(`inputs/${port.id}/to`, []);
            } else if (port.group === 'out') {
              padre.addOutPort(port.id);
              padre.prop(`outputs/${port.id}`, {});
              padre.prop(`outputs/${port.id}/values`, []);
              padre.prop(`outputs/${port.id}/from`, []);
              padre.prop(`outputs/${port.id}/to`, []);
            }
          });
          padre.attr('.label/text', elementView.model.attr('.label/text'));
          // padre.attributes.attrs['.label'].text = elementView.model.attributes.attrs['.label'].text;
          let cont = 3;
          for (const el of arreglo.entries()) {
            el[1].position(cont * 100, cont * 100);
            padre.embed(el[1]);
            cont += 1;
          }
          padre.position(250, 250);

          // se inserta objeto padre al inicio del arreglo 
          arreglo.splice(0, 0, padre);
          // arreglo.reverse();
          // this.currentGraph.addCell(padre);
          const tempGraph = new dia.Graph({}, {
            cellNamespace: {
              opm, shapes
            }
          });
          tempGraph.addCells(arreglo);
          // this.currentGraph.clear();
          // por alguna razon si se hace directo el addcells sobre currentGraph
          // en lugar de hacerlo en un grafo temporal, sale un error
          this.currentGraph.fromJSON(tempGraph.toJSON());

        });
      },

      // evento que escucha cuando un link es desconectado
      'link:disconnect': (linkView, evt, elementViewConnected, magnet, arrowhead) => {
        // todo: borrar toda referencia de que el origen apunto al destino 
        console.log('desconectado----------------------');


      },

      // evento que escucha cuando un link es conectado
      'link:connect': (linkView, evt, elementViewConnected, magnet, arrowhead) => {





        // condicion para eliminar el link si el elemento apunta a si mismo (tal vez sea necesario quitarla despues)
        if (linkView.sourceView.model.id === elementViewConnected.model.id) {
          linkView.model.remove();
          return;
        } else {



          // se crea nuevo link para sustituir al que se crea de manera inicial
          let newLink = new opm.ResultConsumptionLink()
            .router('metro')
            .connector('jumpover');
          let auxInput: InOutStructure;
          let auxOutput: InOutStructure;
          // condicion utilizada cuando el origen es del tipo objeto


          /**nota: falta agregar el caso cuando el destino es el puerto de un ParentObject
           * aparentemente no es necesario, pero puede haber problemas
           */

          if (linkView.sourceView.model.attributes.type === 'opm.Object') {
            // se verifica si el objeto es del subtipo externo o requirement
            if (linkView.model.get('source').port) {
              newLink.attr('line/stroke', '#62FC6A');
              newLink.appendLabel({
                attrs: {
                  text: {
                    text: 'in'
                  }
                }
              });
              // verificar que el puerto del elemento origen sea salida
              if (this.portBelongsToGroup(
                linkView.sourceView.model as shapes.devs.Model,
                linkView.model.get('source').port,
                'out'
              )) {

                newLink.source(linkView.model.source());
                // se checa el caso donde el destino es objeto
                if (elementViewConnected.model.attributes.type === 'opm.Object' ||
                  elementViewConnected.model.attributes.type === 'opm.ChildObject'
                ) {

                  // se verifica que el objeto destino tenga puerto
                  if (!linkView.model.get('target').port) {
                    alertify.error('la conexion solo se puede dirigir hacia un puerto de entrada del objeto');
                    linkView.model.remove();
                    return;
                  } else {
                    // se verifica que el puerto destino sea una entrada
                    if (this.portBelongsToGroup(
                      elementViewConnected.model as shapes.devs.Model,
                      linkView.model.get('target').port,
                      'in')) {
                      // se checan dos casos, si el destino es objeto el link se debe dirigir
                      // hacia una entrada, si el destino es ChildObject el unico destino debe
                      // ser un puerto de salida
                      if (elementViewConnected.model.attributes.type === 'opm.Object') {
                        auxInput = {
                          elementID: linkView.sourceView.model.id,
                          type: linkView.sourceView.model.attributes.type,
                          port: linkView.model.get('source').port,
                          name: linkView.sourceView.model.attr('.label/text')
                        };
                        elementViewConnected.model.get('inputs')[linkView.model.get('target').port]
                          .from.push(auxInput);

                        // elementViewConnected.model.get('inputs')[linkView.model.get('target').port].push(auxInput);


                        auxOutput = {
                          elementID: elementViewConnected.model.id,
                          type: elementViewConnected.model.attributes.type,
                          port: linkView.model.get('target').port,
                          name: elementViewConnected.model.attr('.label/text')
                        };

                        linkView.sourceView.model.get('outputs')[linkView.model.get('source').port]
                          .to.push(auxOutput);
                        // linkView.sourceView.model.get('outputs')[linkView.model.get('source').port].push(auxOutput);


                        newLink.target(linkView.model.target());
                      } else {

                        alertify.error('no se puede realizar la conexion');
                        linkView.model.remove();
                        return;
                      }

                    } else {
                      if (elementViewConnected.model.attributes.type === 'opm.ChildObject') {
                        auxOutput = {
                          // referencia al ID del padre
                          elementID: this.currentID,
                          type: elementViewConnected.model.attributes.type,
                          port: linkView.model.get('target').port,
                          name: elementViewConnected.model.attr('.label/text'),
                        };

                        linkView.sourceView.model.get('outputs')[linkView.model.get('source').port]
                          .to.push(auxOutput);

                        // linkView.sourceView.model.get('outputs')[linkView.model.get('source').port].push(auxOutput);


                        // aqui deberia ir el input,
                        auxInput = {
                          elementID: linkView.sourceView.model.id,
                          type: linkView.sourceView.model.attributes.type,
                          port: linkView.model.get('source').port,
                          name: linkView.sourceView.model.attr('.label/text')
                        };
                        // aunque se dirige a un puerto output se guarda la referencia en el objeto inputs

                        elementViewConnected.model.get('outputs')[linkView.model.get('target').port]
                          .from.push(auxInput);
                        // elementViewConnected.model.get('inputs')[linkView.model.get('target').port].push(cloneDeep(auxInput));



                        newLink.target(linkView.model.target());
                      } else {
                        alertify.error('el puerto destino debe ser de entrada');
                        linkView.model.remove();
                        return;
                      }

                    }
                  }
                } else if (elementViewConnected.model.attributes.type === 'opm.Process') {
                  // recuerda va de el puerto de un objeto al input de in proceso

                  auxInput = {
                    elementID: linkView.sourceView.model.id,
                    port: linkView.model.get('source').port,
                    type: linkView.sourceView.model.attributes.type,
                    name: linkView.sourceView.model.attr('.label/text')
                  };
                  elementViewConnected.model.get('inputs').from.push(auxInput);

                  auxOutput = {
                    elementID: elementViewConnected.model.id,
                    parent: this.currentID,
                    type: elementViewConnected.model.attributes.type,
                    name: elementViewConnected.model.attr('.label/text')

                  }
                  linkView.sourceView.model.get('outputs')[linkView.model.get('source').port]
                    .to.push(auxOutput);

                  newLink.target(linkView.model.target());
                }

              } else {
                alertify.error('el origen debe ser un puerto salida');
                linkView.model.remove();
                return;
              }

            }

            else if (linkView.sourceView.model.attributes.staticParams) {
              if (linkView.sourceView.model.attributes.staticParams.objectSubtype === 'externo') {
                newLink.attr('line/stroke', '#62FC6A');
                newLink.appendLabel({
                  attrs: {
                    text: {
                      text: 'in'
                    }
                  }
                });
                newLink.source(linkView.model.source());

                // si el destino es objeto solo es posible conectarlo hacia un puerto
                if (elementViewConnected.model.attributes.type === 'opm.Object') {
                  if (!linkView.model.get('target').port) {
                    alertify.error('el objeto externo solo se puede conectar a puertos de otros objetos');
                    linkView.model.remove();
                    return;
                  } else {
                    // se verifica si el puerto destino es una salida, en dicho caso se
                    // muestra un error, de lo contrario se asocia el link con el puerto
                    if (this.portBelongsToGroup(
                      elementViewConnected.model as shapes.devs.Model,
                      linkView.model.get('target').port,
                      'out')) {
                      alertify.error('no se puede asociar elemento externo con puerto de salida');
                      linkView.model.remove();
                      return;
                    } else {
                      // conexion exitosa de objeto externo con puerto de otro objeto

                      auxInput = {
                        elementID: linkView.sourceView.model.id,
                        type: 'externo',
                        name: linkView.sourceView.model.attr('.label/text'),
                      }
                      // por el momento solo se toma el parametro value del objeto externo
                      // cuando exista una DesignVariable se debe cambiar la logica
                      elementViewConnected.model.get('inputs')[linkView.model.get('target').port]
                        .values.push(linkView.sourceView.model.get('parametros')[0]['value']);

                      elementViewConnected.model.get('inputs')[linkView.model.get('target').port]
                        .from.push(auxInput);
                      // elementViewConnected.model.get('inputs')[linkView.model.get('target').port].push(auxInput);
                      newLink.target(linkView.model.target());
                    }
                  }
                }
                // cuando el destino es un proceso no es necesario verificar que tenga puertos (por ahora)
                else if (elementViewConnected.model.attributes.type === 'opm.Process') {
                  auxInput = {
                    elementID: linkView.sourceView.model.id,
                    type: 'externo',
                    name: linkView.sourceView.model.attr('.label/text'),

                  }
                  elementViewConnected.model.get('inputs')
                    .values.push(linkView.sourceView.model.get('parametros')[0]['value']);

                  elementViewConnected.model.get('inputs')
                    .from.push(auxInput);


                  newLink.target(linkView.model.target());
                }
              } else if (linkView.sourceView.model.attributes.staticParams.objectSubtype === 'requirement') {
                newLink.attr('line/stroke', '#FF2424');
                newLink.appendLabel({
                  attrs: {
                    text: {
                      text: 'req'
                    }
                  }
                });
                if (elementViewConnected.model.attributes.type === 'opm.Object' || elementViewConnected.model.attributes.type === 'opm.ChildObject') {
                  alertify.error('no se puede asociar requerimientos con otros objetos');
                  linkView.model.remove();
                  return;
                } else {
                  // asociacion de valor de requerimiento a destino
                  elementViewConnected.model.get('reqs').push(linkView.sourceView.model.get('parametros')[0]);

                  newLink.source(linkView.model.source());
                  newLink.target(linkView.model.target());
                }
              } else if (linkView.sourceView.model.attributes.staticParams.objectSubtype === '') {
                console.log('tenemos graves problemas');
                alertify.error('no se puede realizar la conexion');
                linkView.model.remove();
                return;
              }
            }
            // si el origen del link es el puerto de un objeto






            else {
              console.log('si llega aqui mi hermano?');
              alertify.error('no se puede realizar la conexion');
              linkView.model.remove();
              return;
            }
          }

          else if (linkView.sourceView.model.attributes.type === 'opm.Process') {
            newLink.attr('line/stroke', '#4FC8FE');
            newLink.appendLabel({
              attrs: {
                text: {
                  text: 'out'
                }
              }
            });
            // conexion de proceso con proceso
            if (elementViewConnected.model.attributes.type === 'opm.Process') {
              auxOutput = {
                elementID: elementViewConnected.model.id,
                parent: this.currentID,
                type: elementViewConnected.model.attributes.type,
                name: elementViewConnected.model.attr('.label/text')
              }

              linkView.sourceView.model.get('outputs').to.push(auxOutput);

              auxInput = {
                elementID: linkView.sourceView.model.id,
                name: linkView.sourceView.model.attr('.label/text'),
                type: linkView.sourceView.model.attributes.type,
              };

              elementViewConnected.model.get('inputs').from.push(auxInput);


              newLink.source(linkView.model.source());
              newLink.target(linkView.model.target());
            } else if (elementViewConnected.model.attributes.type === 'opm.Object' ||
              elementViewConnected.model.attributes.type === 'opm.ChildObject'
            ) {
              if (!linkView.model.get('target').port) {
                alertify.error('la salida debe dirigirse a un puerto de entrada');
                linkView.model.remove();
                return;
              } else if (this.portBelongsToGroup(
                elementViewConnected.model as shapes.devs.Model,
                linkView.model.get('target').port,
                'in'
              )) {
                if (elementViewConnected.model.attributes.type === 'opm.Object') {
                  // la salida del proceso se dirige al puerto de entrada de un objeto normal

                  auxOutput = {
                    elementID: elementViewConnected.model.id,
                    type: elementViewConnected.model.attributes.type,
                    name: elementViewConnected.model.attr('.label/text'),
                    port: linkView.model.get('target').port,
                  };

                  linkView.sourceView.model.get('outputs').to.push(auxOutput);

                  auxInput = {
                    elementID: linkView.sourceView.model.id,
                    type: linkView.sourceView.model.attributes.type,
                    port: linkView.model.get('source').port,
                    name: linkView.sourceView.model.attr('.label/text'),
                  };

                  elementViewConnected.model.get('inputs')[linkView.model.get('target').port]
                    .from.push(auxInput);


                  newLink.source(linkView.model.source());
                  newLink.target(linkView.model.target());
                } else {
                  alertify.error('no se puede dirigir a la entrada de un ChildObject');
                  linkView.model.remove();
                  return;
                }
              } else {
                if (elementViewConnected.model.attributes.type === 'opm.ChildObject') {
                  // la salida del proceso se dirige al puerto de salida de un ChildObject

                  auxOutput = {
                    elementID: this.currentID,
                    type: elementViewConnected.model.attributes.type,
                    port: linkView.model.get('target').port,
                    name: elementViewConnected.model.attr('.label/text'),
                  };

                  linkView.sourceView.model.get('outputs').to.push(auxOutput);

                  auxInput = {
                    elementID: linkView.sourceView.model.id,
                    type: linkView.sourceView.model.attributes.type,
                    name: linkView.sourceView.model.attr('.label/text'),
                    port: linkView.model.get('source').port,
                  };

                  elementViewConnected.model.get('outputs')[linkView.model.get('target').port]
                    .from.push(auxInput);



                  newLink.source(linkView.model.source());
                  newLink.target(linkView.model.target());
                } else {
                  alertify.error('este tipo de conexion solo se puede hacer con childObjects');
                  linkView.model.remove();
                  return;
                }
              }
            }
          }
          else if (linkView.sourceView.model.attributes.type === 'opm.ChildObject') {

            newLink.attr('line/stroke', '#62FC6A');
            newLink.appendLabel({
              attrs: {
                text: {
                  text: 'in'
                }
              }
            });
            if (this.portBelongsToGroup(
              linkView.sourceView.model as shapes.devs.Model,
              linkView.model.get('source').port,
              'in'
            )) {
              if (elementViewConnected.model.attributes.type === 'opm.Process') {

                auxOutput = {
                  elementID: elementViewConnected.model.id,
                  parent: this.currentID,
                  type: elementViewConnected.model.attributes.type,
                  name: elementViewConnected.model.attr('.label/text'),
                };

                linkView.sourceView.model.get('inputs')[linkView.model.get('source').port]
                  .to.push(auxOutput);

                auxInput = {
                  elementID: this.currentID,
                  type: linkView.sourceView.model.attributes.type,
                  name: linkView.sourceView.model.attr('.label/text'),
                  port: linkView.model.get('source').port,
                }

                elementViewConnected.model.get('inputs').from.push(auxInput);


                newLink.source(linkView.model.source());
                newLink.target(linkView.model.target());
              } else if (elementViewConnected.model.attributes.type === 'opm.Object') {
                if (this.portBelongsToGroup(
                  elementViewConnected.model as shapes.devs.Model,
                  linkView.model.get('target').port,
                  'in'
                )) {

                  auxOutput = {
                    elementID: elementViewConnected.model.id,
                    type: elementViewConnected.model.attributes.type,
                    name: elementViewConnected.model.attr('.label/text'),
                    port: linkView.model.get('target').port,
                  };

                  linkView.sourceView.model.get('inputs')[linkView.model.get('source').port]
                    .to.push(auxOutput);

                  auxInput = {
                    elementID: this.currentID,
                    type: linkView.sourceView.model.attributes.type,
                    name: linkView.sourceView.model.attr('.label/text'),
                    port: linkView.model.get('source').port,
                  }

                  elementViewConnected.model.get('inputs')[linkView.model.get('target').port]
                    .from.push(auxInput);


                  newLink.source(linkView.model.source());
                  newLink.target(linkView.model.target());
                } else {
                  alertify.error('la conexion debe dirigirse solo a puertos de entrada');
                  linkView.model.remove();
                  return;
                }
              }
            } else {
              alertify.error('en objetos inzoomed el origen debe ser un puerto de entrada');
              linkView.model.remove();
              return;
            }
          }
          this.currentGraph.addCell(newLink);
          linkView.model.remove();
        }

        // dado que hay un bug con la opacidad ya que a veces no detecta mouseout
        // se asegura que se elimine ese valor cuando ya no se tenga el puntero en
        // el elemento origen

        linkView.sourceView.model.attr('body/opacity', 'none');


      },



      // evento que escucha cuando se suelta el puntero sobre un link
      // se activa tanto al finalizar la conexion del link como al darle click
      'link:pointerup': (linkView) => {
        paper.removeTools();
        // creacion de herramientas que tendra cada link que sea presionado
        const tools = new dia.ToolsView({
          name: 'opm-link-tools',
          tools: [
            new linkTools.Vertices({
              redundancyRemoval: true,
              vertexAdding: true
            }),
            // interaccion con la flecha del link para poder
            // desconectar y reconectar hacia otro destino
            new linkTools.TargetArrowhead(),
            new linkTools.Boundary({ useModelGeometry: true }),
            new linkTools.SourceAnchor(),
            new linkTools.Segments(),
            // boton para eliminar el link
            new linkTools.Remove({ offset: -20, distance: 40 })
          ]
        });
        linkView.addTools(tools);


      }


    });

    // cuando se presione la tecla suprimir y una celda se encuentre seleccionada
    // se removera del lienzo
    keyboard.on({
      delete: (evt) => {
        evt.preventDefault();
        if (celda) {
          console.log(celda);
          console.log(this.searchNode(this.OPDTree, celda.id));
          if (this.searchNode(this.OPDTree, celda.id)) {
            console.log('prueba de vista superior');
            alertify.error('no es posible eliminar');
          } else if (celda.attributes.type === 'opm.ChildObject') {
            alertify.error('no es posible eliminar');
          }
          else {
            console.log('si llega');


            this.currentGraph.removeCells([celda]);
          }
        }


      },

    });






    // elemento que envuelve el lienzo e implementa scrolling, centrado, entre otros
    const scroller = this.scroller = new ui.PaperScroller({
      paper,
      autoResizePaper: true,
      cursor: 'grab',
      scrollWhileDragging: true,
    });
    scroller.render();




    const rect = new opm.Object().resize(350, 149) as shapes.devs.Atomic;
    rect.changeInGroup(shapeConfig.inPortProps);
    rect.changeOutGroup(shapeConfig.outPortProps);



    const circ = new opm.Process().resize(300, 150) as shapes.devs.Atomic;
    circ.changeInGroup(shapeConfig.inPortProps);
    circ.changeOutGroup(shapeConfig.outPortProps);

    // declaracion de paleta que contendra los elementos basicos de OPM
    const stencil = this.stencil = this.stencilServ.createOPMStencil(scroller);

    stencil.render();

    // carga de figuras basicas de OPM en la paleta
    stencil.load({ OPM: [rect, circ] });



    // declaracion de paleta donde se mostraran diagramas alojados en base de datos
    // y que pueden ser arrastrados para formar parte de un nuevo sistema.
    const stencilDB = this.stencilDB = this.stencilServ.createDBStencil(scroller);


    this.dbObjects = [];
    this.objectMaps = {};
    // se carga por primera vez los diagramas alojados en la base de datos
    this.updateStencilDB(stencilDB);
    //this.updateStencilDB(stencilDB);

    // evento del grafo que se activa cuando se agrega un elemento al lienzo
    this.currentGraph.on('add', (cell: dia.Cell, collection, opt) => {
      // se verifica si el objeto agregado viene de un stencil
      // tambien se comprueba que el tipo de elemento sea imagen ya que
      // los elementos con este tag son utilizados para guardar las referencias
      // correspondientes a los diagramas obtenidos de la base de datos
      if (opt.stencil && cell.attributes.type === 'standard.Image') {
        // se itera sobre el atributo object maps para encontrar el elemento con
        // el id correspondiente
        const tempImg = cell as shapes.standard.Image;
        const imgPosition = tempImg.position();
        // dado que la imagen solo se usa como referencia para mostrar una vista previa
        // del verdadero modelo, se elimina del diagrama actual
        this.currentGraph.removeCells([cell]);

        for (const element of this.objectMaps) {
          if (cell.attributes.prop.mongoID === element._id) {



            // se guarda en grafo y se renderiza el json que corresponda al elemento arrastrado
            if (isString(element.grafo)) {
              const tempTree = JSON.parse(element.grafo) as OPDNode[];
              this.tempGraph = new dia.Graph({}, { cellNamespace: { opm, shapes } });
              this.tempGraph.fromJSON(tempTree[0].jsonGraph);
              const celdas = this.tempGraph.getCells();


              /*
              se encontro un conflicto cuando se utilizaba el metodo this.currentGraph.clear()
              ya que al hacerlo no desaparecia la figura arrastrada del stencil tanto en pantalla
              como en las propiedades del grafo. Se soluciona temporalmente igualando la propiedad
              graph de una figura existente con la de la celda ya que por alguna razon esta se marcaba
              como null cuando se llamaba a clear.
              */
              const figura = new opm.Process();
              if (celdas.length === 1) {
                const tmpModel = celdas[0] as shapes.devs.Model;


                tmpModel.position(imgPosition.x, imgPosition.y);
              }
              celdas.forEach((dataCell) => {
                dataCell.graph = figura.graph;
              });

              this.currentGraph.addCells(celdas);

              // si el modelo tomado de la base de datos tiene hijos, se agregan al  diseno actual
              if (tempTree[0].children) {
                const currentNode = this.searchNode(this.OPDTree, this.currentID);
                if (tempTree[0].children) {
                  if (!currentNode.children) {
                    currentNode.children = new Array<OPDNode>();
                  }
                  for (const child of tempTree[0].children) {
                    currentNode.children.push(child);
                  }
                }

              }

            }

            this.treeViewChild.updateTree(this.OPDTree);
            paper.update();
            break;
          }
        }
      }
      // se cambian las dimensiones del objeto cuando es agregado desde el stencil
      else if (opt.stencil && cell.attributes.type === 'opm.Object') {
        cell.attributes.size.height = 60;
        cell.prop('inputs', {});
        cell.prop('outputs', {});
        cell.prop('isParent', false);


      }
      // se cambian las dimensioneWs del elemento proceso cuando es agregado desde el stencil
      else if (opt.stencil && cell.attributes.type === 'opm.Process') {
        cell.attributes.size.height = 80;
        cell.attributes.size.width = 150;
        cell.prop('reqs', []);
        cell.prop('inputs', {});
        cell.prop('inputs/values', []);
        cell.prop('inputs/from', []);
        cell.prop('outputs', {});
        cell.prop('outputs/values', []);
        cell.prop('outputs/to', []);
        cell.prop('parentID', this.currentID);
      }
    });

    this.currentGraph.on('remove', (cell, collection, opt) => {
      if (cell.isLink()) {
        if (cell.attributes.type !== 'opm.tempLink') {
          // todo: borrar referencias de inouts en origen y destino
          console.log(this.currentGraph.getCell(cell.attributes.source));
          console.log(this.currentGraph.getCell(cell.attributes.target));

        }
      }
    });



    // barra de herramientas superior
    const toolbar = this.toolbar = new ui.Toolbar({
      tools: [
        { type: 'zoomIn', name: 'zoomIn', },
        { type: 'zoomOut', name: 'zoomOut', },
        { type: 'zoomToFit', name: 'fit' },
        { type: 'separator' },
        { type: 'button', name: 'save_server', text: 'Save to Server' },
        { type: 'button', name: 'load', text: 'Load Diagram' },
        { type: 'button', name: 'save', text: 'Save' },
        { type: 'button', name: 'clear', text: 'Clear' },
        { type: 'separator' },
        { type: 'button', name: 'connect', text: 'connect' },
        { type: 'button', name: 'print_tree', text: 'tree' }
      ],
      // se utilizan las referencias para que los botones tengan interaccion con
      // el lienzo u otros elementos
      references: {
        paperScroller: scroller
      }
    });

    toolbar.on('print_tree:pointerclick', (evt) => {
      console.log(this.OPDTree);
      console.log(this.currentGraph);
      console.log(this.currentGraph.toJSON());
    });



    // evento que escucha cuando se presiona el boton clear de la barra de herramientas
    toolbar.on('clear:pointerclick', (evt) => {
      // se elimina el contenido del grafo y se actualiza el paper
      console.log('grafo antes de limpiar');
      console.log(this.currentGraph);
      this.currentGraph.clear();
      this.initTree();
      this.treeViewChild.updateTree(this.OPDTree);
      paper.update();
    });

    // evento que escucha cuanco se presiona el boton save_server de la barra de herramientas
    toolbar.on('save_server:pointerclick', (evt) => {


      this.openSaveDialog(paper, stencilDB);
    });

    // evento que escucha cuando se presiona el boton load
    toolbar.on('load:pointerclick', () => {
      // se genera un cuadro de dialogo con un formulario para insertar un archivo JSON
      // para que sea cargado en el lienzo
      const dialogo = new ui.Dialog({
        // cadena html que contiene el formulario
        content: '<form id="formCarga" enctype="multipart/form-data"><input type="file" id="archivo" name="archivo" required accept="application/json"></input></form>',
        buttons: [{
          content: 'cargar',
          position: 'left',
          action: 'cargar'
        }],
        modal: true,
        type: 'info',
        closeButton: true,
        width: 400,
        title: 'Cargar archivo JSON'
      }).open();

      // evento que escucha la interaccion con el boton cargar de la ventana de dialogo
      dialogo.on('action:cargar', (event) => {
        const formData = new FormData(document.querySelector('form#formCarga'));

        // se obtiene contenido del archivo subido al formulario
        const ar = formData.get('archivo') as File;
        const success = (content: string) => {

          // se convierte en formato JSON el texto generado en la funcion readAsText
          const jas: OPDNode[] = JSON.parse(content);

          // se limpia contenido del grafo y se carga el contenido obtenido en el archivo
          console.log(jas);
          this.currentGraph.clear();
          this.treeViewChild.updateTree(jas);
          this.currentID = jas[0].id;
          this.OPDTree = jas;
          this.currentGraph.fromJSON(jas[0].jsonGraph);
          console.log(this.currentGraph);

          dialogo.close();
          paper.update();
        };
        const reader = new FileReader();
        // este evento se activa cada que la operacion de lectura se completa de forma exitosa
        // nota: si da algun error en el futuro quitar el casteo a string y quitar
        // el tipado al argumento de la funcion success
        reader.onload = (evt) => { success(evt.target.result as string); };
        // lee el contenido de un archivo como texto
        // desencadena el evento onload y si tiene exito se ejecuta la funcion success
        reader.readAsText(ar);




      });
    });





    // evento que se activa al presionar el boton save de la barra de herramientas
    toolbar.on('save:pointerclick', (event) => {

      // funcion que genera un objeto que representa el diagrama
      // en imagen PNG
      paper.toPNG(async (imgData) => {

        // se utiliza componente de rappid que muestra una imagen en pantalla
        // y atenua el resto del contenido
        const light = new ui.Lightbox({
          title: 'Guardar diagrama',
          image: imgData,
          // opcion que permite descargar la imagen mostrada
          downloadable: true,
          modal: true,
          buttons: [{
            // boton adicional de este componente
            content: 'descargar JSON',
            position: 'left',
            action: 'descargar_json'
          }],
        }).open();

        // evento para descargar el json generado al presionar el boton descargar json
        light.on('action:descargar_json', () => {

          const nodo = this.searchNode(this.OPDTree, this.currentID);
          nodo.jsonGraph = this.currentGraph.toJSON();
          const blob = new Blob([JSON.stringify(this.OPDTree)], { type: 'text/plain;charset=utf-8' });
          // se utiliza libreria file-saver para habilitar la accion de descarga de contenido sobre un archivo definido
          saveAs(blob, 'diagrama.json');
          alertify.success('archivo descargado');
        });
      });

    });


    toolbar.on('connect:pointerclick', (event) => {
      // se actualiza contenido de nodo atual
      const nodo = this.searchNode(this.OPDTree, this.currentID);
      nodo.jsonGraph = this.currentGraph.toJSON();
      this.mongo.connectToMatlab(this.OPDTree).subscribe((data) => {
        let resultString: string = "";
        resultString = `
        <table>
          <tr>
            <th>origen</th>
            <th>resultado</th>
          </tr>
        `;
        for (const llave of Object.keys(data)) {
          resultString += '<tr>';
          resultString += '<td>' + llave + '</td><td>' + (Math.round(data[llave] * 100) / 100).toFixed(2) + '</td>';
          resultString += '</tr>';
        }

        Swal.fire({
          title: 'Resultados',
          html: resultString,
          confirmButtonText: 'Salir'
        });
        console.log('response:');
        console.log(data);
      }, (err: HttpErrorResponse) => {
        if (err.status === 500) {
          alertify.error('Error en el servidor');
        } else if (err.status === 0) {
          alertify.error('No se pudo establecer conexion con el servidor');
        } else if (err.status === 503) {
          alertify.error('servidor matlab no disponible');
        }
        console.error(err);

      });
    });

    toolbar.render();

    // evento que permite cambiar el tamano de un elemento del diagrama
    paper.on('cell:pointerup', (cellView) => {
      // se evita la posibilidad de transformar links
      if (cellView.model instanceof dia.Link) { return; }

      // se agrega el elemento FreeTransform al cellView seleccionado
      const freeTransform = new ui.FreeTransform({ cellView });
      freeTransform.render();
    });


    // evento para crear un inspector cada que se hace click en algun elemento del diagrama
    paper.on('element:pointerclick', (elementView: dia.ElementView) => {
      // se verifica si ya existe una instancia global de un inspector
      // de ser asi se elimina
      if (this.globalInspector) {
        this.globalInspector.remove();
      }
      // se crea inspector y se guarda instancia en el atributo global
      this.globalInspector = utils.createInspector(elementView);
    });



  }



  public ngAfterViewInit(): void {
    const { scroller, paper, canvas, stencilContainer, stencilDBContainer, toolbarContainer } = this;
    // se asocia el codigo generado por cada elemento de la clase con los divs que se
    // encuentran en el html
    toolbarContainer.nativeElement.appendChild(this.toolbar.el);
    stencilDBContainer.nativeElement.appendChild(this.stencilDB.el);
    stencilContainer.nativeElement.appendChild(this.stencil.el);
    canvas.nativeElement.appendChild(this.scroller.el);

    scroller.center();
    paper.unfreeze();
  }



  updateStencilDB(stencil: ui.Stencil) {
    this.dbObjects = [];
    this.objectMaps = {};
    const dbGroups = { Componentes: [], Subsistemas: [], Sistemas: [] };
    // se realiza una peticion para obtener todos los registros

    this.mongo.getRegistros().subscribe((data: Array<any>) => {
      // se guarda el arreglo de registros obtenidos de mongo
      this.objectMaps = data;

      for (const element of data) {
        // se extrae la imagen que contiene cada elemento de la base de datos
        // y se crea una figura
        const imgAux = new shapes.standard.Image({
          size: { width: 100, height: 100 },
          position: { x: 10, y: 10 },
          attrs: {
            image: {
              xlinkHref: element.image,
            },
            label: {
              text: element.name,
              fill: 'white'
            }
          },
          // se agrega una propiedad para asociar el id del registro de mongo a la imagen
          prop: { mongoID: element._id }
        });

        dbGroups[element.group].push(imgAux);


        this.dbObjects.push(
          imgAux
        );
      }

      // se ajustan las dimensiones del contenedor de grupos conforme al numero de elementos
      // que pertenezcan a ellos
      stencil.options.groups.Componentes.height = 120 * Math.ceil(dbGroups.Componentes.length / 2);
      stencil.options.groups.Subsistemas.height = 120 * Math.ceil(dbGroups.Subsistemas.length / 2);
      stencil.options.groups.Sistemas.height = 120 * Math.ceil(dbGroups.Sistemas.length / 2);

      stencil.render();
      // se cargan las figuras en el grupo correspondiente
      stencil.load({
        Componentes: dbGroups.Componentes,
        Subsistemas: dbGroups.Subsistemas,
        Sistemas: dbGroups.Sistemas,
      });
      stencil.closeGroups();
    }, (err) => { alertify.error('No se han podido cargar los registros de la base de datos'); });

  }







}
