import { OnInit, Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { dia, ui, shapes, setTheme, g, linkTools, util } from '@clientio/rappid';
import { MongoService } from './services/mongo.service';
import { RappidOPMUtils, OPDNode } from './utils/rappid-opm-utils';
import { saveAs } from 'file-saver';
import * as alertify from 'alertifyjs';
import { opm, shapeConfig } from './utils/custom-shapes';
import { DialogoComponent } from './components/dialogo/dialogo.component';
import { MatDialog } from '@angular/material/dialog';
import { cloneDeep, isString } from 'lodash';

import { TreeViewComponent } from './components/tree-view/tree-view.component';
import { DialogoSaveComponent } from './components/dialogo-save/dialogo-save.component';
import { StencilService } from './services/stencil.service';



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
  private rootGraph: dia.Graph;
  private currentGraph: dia.Graph;
  private keyboard: ui.Keyboard;
  private paper: dia.Paper;
  private scroller: ui.PaperScroller;
  private stencil: ui.Stencil;
  private stencilDB: ui.Stencil;
  private toolbar: ui.Toolbar;
  OPDTree: OPDNode[] = [];
  currentID: string;
  private dbObjects: Array<shapes.standard.Image>;
  private objectMaps: any;
  private globalInspector: ui.Inspector;

  constructor(private mongo: MongoService,
              public dialog: MatDialog,
              public stencilServ: StencilService) { }

  /**
   * funcion utilizada para llamar una ventana de dialogo para agregar puertos
   * de entrada o salida a un elemento (objecto o proceso)
   * @param elemento modelo del elemento
   */
  openMatDialog(elemento: dia.ElementView) {
    // se abre la ventana de dialogo y se guarda la referencia en una variable
    const dialogRef = this.dialog.open(DialogoComponent);
    // por medio de la referencia se suscribe al objeto parentCOM para
    // estar pendiente cuando emita un evento
    dialogRef.componentInstance.parentCOM.subscribe(() => {
      let port: {};
      // se verifica el tipo guardado en la referencia
      // y se crea el puerto que corresponda
      if (dialogRef.componentInstance.tipo === '0') {
        port = {
          group: 'in',
          attrs: {
            text: {
              // se pasa como texto el valor que tenga el input de la ventana de dialog
              text: dialogRef.componentInstance.nombre
            }
          },
        };
      } else if (dialogRef.componentInstance.tipo === '1') {
        port = {
          group: 'out',
          attrs: {
            text: {
              text: dialogRef.componentInstance.nombre
            }
          }
        };
      }


      elemento.model.addPort(port);
      if (dialogRef.componentInstance.closed) {
        dialogRef.close();
      }
    });

  }

  openSaveDialog(paper: dia.Paper, stencil: ui.Stencil) {
    // se abre la ventana de dialogo y se guarda la referencia en una variable
    const dialogRef = this.dialog.open(DialogoSaveComponent);
    // por medio de la referencia se suscribe al objeto parentCOM para
    // estar pendiente cuando emita un evento
    dialogRef.componentInstance.parentCOM.subscribe(() => {
      const tipo = dialogRef.componentInstance.seleccionado;
      const nombre = dialogRef.componentInstance.nombre;
      // se llama funcion to PNG para crear una imagen con el contenido
      // actual del diagrama
      paper.toPNG((imgData) => {
        this.mongo.insertGraph(this.currentGraph.toJSON(), imgData, tipo, nombre).subscribe((data) => {
          this.stencilServ.updateStencilDB(this.dbObjects, this.objectMaps, stencil, this.mongo);
          //this.updateStencilDB(stencil);
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
   * de parametros que tenga un elemento 'opm.object'
   * @param el modelo del elemento seleccionado
   * @returns arreglo de objetos
   */
  createObjectArray(el: dia.ElementView): Array<shapes.devs.Atomic> {
    const arreglo: Array<shapes.devs.Atomic> = [];
    // se verifica la existencia del atributo parametros. En caso de
    // encontrarlo se itera sobre las entradas de su arreglo

    if (el.model.attributes.parametros !== undefined) {
      for (const params of el.model.attributes.parametros.entries()) {

        const tempObj = new opm.Object() as shapes.devs.Atomic;
        // entries genera un iterador con los pares clave/valor, para los indices del array
        // por ello se toma el segundo y es el que se asigna a los parametros del objeto temporal
        tempObj.attributes.parametros = [params[1]];
        // se pone al objeto temporal el nombre del parametro seleccionado
        tempObj.attr('.label/text', params[1].name);

        arreglo.push(tempObj);
      }
    }

    return arreglo;
  }

  searchNode(tree: OPDNode[], id: string): OPDNode {
    for (const element of tree) {
      console.log(element.id);
      if (element.id === id) {
        console.log('si hace algo');
        // se debe retornar el nodo en realidad
        return element;
      } else if (element.children) {
        return this.searchNode(element.children, id);
      }
    }
  }

  changeGraphView($event: OPDNode) {
    console.log('id del evento: ', $event);
    if (this.currentID === $event.id) {
      console.log('se esta seleccionando lo mismo');
    } else {
      const currentNode = this.searchNode(this.OPDTree, this.currentID);
      if (currentNode === null) {
        console.log(this.currentID);
        console.log(this.OPDTree);
        console.log('no se encontro nodo actual');
      }
      currentNode.jsonGraph = cloneDeep(this.currentGraph);
      const nodo = this.searchNode(this.OPDTree, $event.id);
      if (nodo === null) {
        console.log('no se encontro nodo al que se desea cambiar');
      }
      this.currentID = $event.id;
      this.currentGraph.clear();
      this.currentGraph.fromJSON(nodo.jsonGraph.toJSON());
    }
    console.log('cambio de vista');
    console.log($event);
  }

  initTree() {
    this.OPDTree = [];
    this.OPDTree.push({
      name: 'root',
      id: 'root',
      type: 'root',
      jsonGraph: this.currentGraph,
      level: 0,
    });
    this.currentID = 'root';
  }



  public ngOnInit(): void {






    // objeto que contiene todas las definiciones de OPM
    const aux = new RappidOPMUtils();



    // tema de rappid
    setTheme('modern');
    // objeto que contendra toda la estructura del grafo generado en el diagrama
    this.rootGraph = new dia.Graph({}, {
      // se debe especificar el namespace de shapes para que reconozca las figuras
      // personalizadas
      // cellNamespace: shapes
      cellNamespace: { opm, shapes }
    });

    this.currentGraph = this.rootGraph;
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
        return new opm.ResultConsumptionLink()
          .router('metro')
          .connector('jumpover');
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
            { action: 'zoom', content: 'in zoom' }
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
        ct.on('action:zoom', () => {
          // se crea nueva grafo
          const nodoActual = this.searchNode(this.OPDTree, this.currentID);
          if (nodoActual.children === undefined) {
            nodoActual.children = [];
          }

          nodoActual.jsonGraph = cloneDeep(this.currentGraph);

          nodoActual.children.push({
            name: elementView.model.attributes.attrs['.label'].text,
            id: elementView.model.id,
            type: 'opm.object',
            level: nodoActual.level + 1
          });
          this.currentID = elementView.model.id;




          this.treeViewChild.updateTree(this.OPDTree);
          const arreglo = this.createObjectArray(elementView) as Array<shapes.devs.Atomic>;
          const zoomGraph = new dia.Graph();
          const padre = new opm.ParentObject() as shapes.devs.Coupled;

          padre.resize(400, 400);
          padre.changeInGroup(shapeConfig.inPortProps);
          padre.changeOutGroup(shapeConfig.outPortProps);
          // this.graphContainer.root = cloneDeep(this.rootGraph);
          this.currentGraph.clear();
          padre.attributes.attrs['.label'].text = elementView.model.attributes.attrs['.label'].text;
          let cont = 0;
          for (const el of arreglo.entries()) {
            el[1].position(cont * 100, cont * 100);
            padre.embed(el[1]);
            // console.log(el[1]);
            cont += 1;
          }
          zoomGraph.addCell(padre);
          zoomGraph.addCells(arreglo);
          // padre.position(250, 250);

          this.currentGraph.fromJSON(zoomGraph.toJSON());
          ct.remove();
        });
      },

      // evento que escucha cuando un link es desconectado
      'link:disconnect': (linkView, evt, elementViewConnected, magnet, arrowhead) => {
        console.log('desconectado----------------------');
        // console.log(linkView);
        // console.log(elementViewConnected);

      },

      // evento que escucha cuando un link es conectado
      'link:connect': (linkView, evt, elementViewConnected, magnet, arrowhead) => {
        console.log('conectado----------------------');
        // condicion para eliminar el link si apunta al elemento origen
        if (linkView.sourceView.model.id === elementViewConnected.model.id) {
          linkView.model.remove();
          return;
        } else {
          if (!linkView.sourceView.model.attributes.outputs) {
            linkView.sourceView.model.attributes.outputs = {};
          }
          if (!elementViewConnected.model.attributes.inputs) {
            elementViewConnected.model.attributes.inputs = {};
          }
          this.globalInspector = aux.createInoutInspector(linkView.sourceView);


          // console.log(elementViewConnected.model);
          // console.log(linkView.sourceView.model);
          console.log('objeto a objeto');
          if ((linkView.sourceView.model.attributes.type === 'opm.Object') &&
            (elementViewConnected.model.attributes.type === 'opm.Object')) {

          }
          else if ((linkView.sourceView.model.attributes.type === 'opm.Object') &&
            (elementViewConnected.model.attributes.type === 'opm.Process')) {
            console.log('objeto a proceso');
            // todo: comportamiento cuando un link apunta de objeto a proceso
          } else if ((linkView.sourceView.model.attributes.type === 'opm.Process') &&
            (elementViewConnected.model.attributes.type === 'opm.Process')) {
            console.log('proceso a proceso');
            // todo: comportamiento cuando un link apunta de proceso a proceso
          }
          else if ((linkView.sourceView.model.attributes.type === 'opm.Process') &&
            (elementViewConnected.model.attributes.type === 'opm.Object')) {
            console.log('proceso a objeto');
            // todo: comportamiento cuando un link apunta de proceso a objeto
          }
        }

        // dado que hay un bug con la opacidad ya que a veces no detecta mouseout
        // se asegura que se elimine ese valor cuando ya no se tenga el puntero en
        // el elemento origen
        linkView.sourceView.model.attr('body/opacity', 'none');

        // personalizar para los casos cuando se conecta de objeto a objeto / proceso
        // o de proceso a proceso / objeto
      },

      'link:contextmenu': (linkView) => {
        this.globalInspector.remove();
        this.globalInspector = aux.createInoutInspector(linkView.sourceView);
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
          this.currentGraph.removeCells([celda]);
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



    const circ = new opm.Process().resize(300, 150);
    // declaracion de paleta que contendra los elementos basicos de OPM
    const stencil = this.stencil = this.stencilServ.createOPMStencil(scroller);

    stencil.render();

    // carga de figuras basicas de OPM en la paleta
    stencil.load({ OPM: [rect, circ] });



    // declaracion de paleta donde se mostraran diagramas alojados en base de datos
    // y que pueden ser arrastrados para formar parte de un nuevo sistema.
    const stencilDB = this.stencilDB = this.stencilServ.createDBStencil(scroller);

    stencilDB.render();
    stencilDB.closeGroups();
    // se carga por primera vez los diagramas alojados en la base de datos
    this.stencilServ.updateStencilDB(this.dbObjects, this.objectMaps, stencilDB, this.mongo);
    //this.updateStencilDB(stencilDB);

    // evento del grafo que se activa cuando se agrega un elemento al lienzo
    this.currentGraph.on('add', (cell, collection, opt) => {
      // se verifica si el objeto agregado viene de un stencil
      // tambien se comprueba que el tipo de elemento sea imagen ya que
      // los elementos con este tag son utilizados para guardar las referencias
      // correspondientes a los diagramas obtenidos de la base de datos
      if (opt.stencil && cell.attributes.type === 'standard.Image') {
        // se itera sobre el atributo object maps para encontrar el elemento con
        // el id correspondiente
        for (const element of this.objectMaps) {
          if (cell.attributes.prop.mongoID === element._id) {

            this.currentGraph.clear();
            // se guarda en grafo y se renderiza el json que corresponda al elemento arrastrado
            if (isString(element.grafo)) {
              this.currentGraph.fromJSON(JSON.parse(element.grafo));
            } else {
              this.currentGraph.fromJSON(element.grafo);
            }
            paper.update();
            break;
          }
        }
      }
      // se cambian las dimensiones del objeto cuando es agregado desde el stencil
      else if (opt.stencil && cell.attributes.type === 'opm.Object') {
        cell.attributes.size.height = 60;


      }
      // se cambian las dimensioneWs del elemento proceso cuando es agregado desde el stencil
      else if (opt.stencil && cell.attributes.type === 'opm.Process') {
        cell.attributes.size.height = 80;
        cell.attributes.size.width = 150;
      }
    });

    // barra de herramientas superior
    const toolbar = this.toolbar = new ui.Toolbar({
      tools: [
        { type: 'zoomIn', name: 'zoomIn', },
        { type: 'zoomOut', name: 'zoomOut', },
        { type: 'zoomToFit', name: 'fit' },
        { type: 'separator' },
        // { type: 'button', name: 'nuevo', text: 'new Diagram' },
        { type: 'button', name: 'save_server', text: 'Save to Server' },
        { type: 'button', name: 'load', text: 'Load Diagram' },
        { type: 'button', name: 'save', text: 'Save' },
        { type: 'button', name: 'clear', text: 'Clear' },
        { type: 'separator' },
      ],
      // se utilizan las referencias para que los botones tengan interaccion con
      // el lienzo u otros elementos
      references: {
        paperScroller: scroller
      }
    });



    // evento que escucha cuando se presiona el boton clear de la barra de herramientas
    toolbar.on('clear:pointerclick', (evt) => {
      // se elimina el contenido del grafo y se actualiza el paper
      this.currentGraph.clear();
      this.initTree();
      this.treeViewChild.updateTree(this.OPDTree);
      paper.update();
    });

    // evento que escucha cuanco se presiona el boton save_server de la barra de herramientas
    toolbar.on('save_server:pointerclick', (evt) => {

      //
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
          const jas = JSON.parse(content);

          // se limpia contenido del grafo y se carga el contenido obtenido en el archivo

          this.currentGraph.clear();
          this.currentGraph.fromJSON(jas);
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
          const blob = new Blob([JSON.stringify(this.currentGraph.toJSON())], { type: 'text/plain;charset=utf-8' });
          // se utiliza libreria file-saver para habilitar la accion de descarga de contenido sobre un archivo definido
          saveAs(blob, 'diagrama.json');
          alertify.success('archivo descargado');
        });
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
    paper.on('element:pointerclick', (elementView) => {
      // se verifica si ya existe una instancia global de un inspector
      // de ser asi se elimina
      if (this.globalInspector) {
        this.globalInspector.remove();
      }
      // se crea inspector y se guarda instancia en el atributo global
      this.globalInspector = aux.createInspector(elementView);
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







}
