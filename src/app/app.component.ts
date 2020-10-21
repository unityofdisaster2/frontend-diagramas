import { OnInit, Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { dia, ui, shapes, setTheme, g, linkTools, util } from '@clientio/rappid';
import { MongoService } from './services/mongo.service';
import { RappidOPMUtils } from './utils/rappid-opm-utils';
import { saveAs } from 'file-saver';
import * as alertify from 'alertifyjs';
import { HttpClient } from '@angular/common/http';
import { opm } from './utils/custom-shapes';

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

  // declaracion de componentes de la clase
  private graph: dia.Graph;
  private graphStructure: object;
  private keyboard: ui.Keyboard;
  private paper: dia.Paper;
  private scroller: ui.PaperScroller;
  private stencil: ui.Stencil;
  private stencilDB: ui.Stencil;
  private toolbar: ui.Toolbar;
  private dbObjects: Array<object>;
  private objectMaps: any;
  private globalInspector: ui.Inspector;

  constructor(private mongo: MongoService, private http: HttpClient) { }



  public ngOnInit(): void {

    //objeto que contiene todas las definiciones de OPM
    const aux = new RappidOPMUtils();


    // tema de rappid
    setTheme('modern');

    // objeto que contendra toda la estructura del grafo generado en el diagrama
    const graph = this.graph = new dia.Graph({}, {
      // se debe especificar el namespace de shapes para que reconozca las figuras
      // personalizadas
      // cellNamespace: shapes
      cellNamespace: { opm, shapes }
    });

    interface GraphStructure {
      root: dia.Graph;
      level: 0;
      inZoomedChildrens?: [{
        name: string,
        kind: string,
        id: string,
        level: number,
        structure: GraphStructure
      }];
    }
    // como la interfaz anterior tecnicamente puede crecer hasta infinito
    // la forma mas "facil" de iterar sobre un objeto que la utilice
    // seria utilizando recursion o un ciclo muy complejo


    // clase que tenga root, tenga children, se pueda agregar valores a los children
    // y esos children tengan la opcion de agregar mas children
    // if element has childs


    // una clase que tenga como parametro la misma clase o en este caso 
    // una interfaz que tenga como parametro su propio tipo
    let algo: GraphStructure;

    algo.root = graph;






    // objeto utilizado para capturar eventos de teclado
    const keyboard = this.keyboard = new ui.Keyboard();

    // declaracion de lienzo que contendra los elementos de diagrama
    const paper = this.paper = new dia.Paper({
      gridSize: 10,
      drawGrid: {
        name: 'mesh'
      },
      model: graph,
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
      embeddingMode: false,
      cellViewNamespace: { opm, shapes }
    });

    // objeto que permite seleccionar elementos de maneras personalizadas
    const selection = new ui.Selection({
      paper,
      graph
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
        console.log(graph);
        if (this.globalInspector) {
          this.globalInspector.remove();
        }

        // si se presiona en cualquier parte del lienzo que no sea un elemento
        // del diagrama se desactiva el estado
        celda = null;
      },
      'blank:pointerup': (evt, x, y) => {

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
        const elementoInferior = graph.findModelsFromPoint(coordenadas).find((el => {
          return (el.id !== elementoSuperior.id);
        }));

        // si existe un elemento debajo se retorna el elemento superior a su posicion original
        if (elementoInferior) {
          elementoSuperior.position(evt.data.x, evt.data.y);
        }
      },

      'element:pointerdblclick': (elementView, evt) => {
        alertify.success('doble click a elemento');
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

      'element:contextmenu': (elementView, evt) => {
        console.log(elementView);
        const ct = new ui.ContextToolbar({
          tools: [
            { action: 'add_port', content: 'agregar puerto' },
            { action: 'zoom', content: 'in zoom' }
          ],
          target: elementView.el,
          autoClose: true,
        });
        ct.render();

        ct.on('action:add_port', () => {
          console.log('si funciona la accions');
          const port = {
            group: 'in',
            attrs: {
              '.port-body': {
                fill: '#16A085',
                magnet: 'passive'
              },
            }
          };
          const port2 = {
            group: 'in',
            attrs: {
              '.port-body': {
                fill: '#16A085'
              }
            }
          };
          elementView.model.addPort(port);
          elementView.model.addPort(port2);
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
      // se activa tanto finalizar la conexion del link como al darle click
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
    keyboard.on('delete', () => {
      if (celda) { celda.remove(); }
    });






    // elemento que envuelve el lienzo e implementa scrolling, centrado, entre otros
    const scroller = this.scroller = new ui.PaperScroller({
      paper,
      autoResizePaper: true,
      cursor: 'grab',
      scrollWhileDragging: true,
    });
    scroller.render();




    // primer acercamiento al elemento que define la figura para los objetos OPM
    // const rect = aux.getOPMObject();

    const rect = new opm.Object().resize(350, 149);



    // primer acercamiento al elemento que define la figura para los procesos OPM

    // const circ = aux.getOPMProcess();

    const circ = new opm.Process().resize(300, 150);
    // declaracion de paleta que contendra los elementos basicos de OPM
    const stencil = this.stencil = new ui.Stencil({
      paper: scroller,
      label: 'Object Process Methodology',
      width: 200,
      dropAnimation: true,
      groupsToggleButtons: true,
      groups: {
        g1: { index: 1, label: 'grupo1', height: 300 },

      },
      layout: {
        columnWidth: 150,
        columns: 1,
        rowHeight: 100,
      }
    });

    stencil.render();

    // carga de figuras basicas de OPM en la paleta
    stencil.load({ g1: [rect, circ] });



    // declaracion de paleta donde se mostraran diagramas alojados en base de datos
    // y que pueden ser arrastrados para formar parte de un nuevo sistema.
    const stencilDB = this.stencilDB = new ui.Stencil({
      paper: scroller,
      label: 'coleccion de diagramas',
      scaleClones: true,
      width: 200,
      groups: {
        myShapesGroup1: { index: 1, label: 'Componentes', height: 600 },
        subsistemas: { index: 2, label: 'Subsistemas', height: 600 },
        sistemas: { index: 3, label: 'Sistemas', height: 600 }
      },
      dropAnimation: true,
      groupsToggleButtons: true,
      search: {
        // se puede implementar la busqueda por un atributo especifico
        '*': ['type', 'attrs/label/text']
      },
      // se utiliza layout para que los elementos no se muestren de forma desordenada
      layout: true  // Use default Grid Layout
    });

    stencilDB.render();
    stencilDB.closeGroups();
    // se carga por primera vez los diagramas alojados en la base de datos
    this.updateStencilDB(stencilDB, 'myShapesGroup1');



    // barra de herramientas superior
    const toolbar = this.toolbar = new ui.Toolbar({
      tools: [
        { type: 'zoomIn', name: 'zoomIn', },
        { type: 'zoomOut', name: 'zoomOut', },
        { type: 'zoomToFit', name: 'fit' },
        { type: 'separator' },
        //{ type: 'button', name: 'nuevo', text: 'new Diagram' },
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
      graph.clear();
      paper.update();
    });

    // evento que escucha cuanco se presiona el boton save_server de la barra de herramientas
    toolbar.on('save_server:pointerclick', (evt) => {
      // se llama funcion to PNG para crear una imagen con el contenido
      // actual del diagrama
      paper.toPNG(async (imgData) => {
        // se envia grafo e imagen a la base de datos
        this.mongo.insertGraph(graph.toJSON(), imgData).subscribe((data) => { }, (err) => {
          alertify.error('no se pudo establecer conexion con la base de datos');
        });
        // se actualiza el stencil con el nuevo registro
        this.updateStencilDB(stencilDB, 'myShapesGroup1');
        //alertify.success('diagrama guardado en servidor');
      });
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
          console.log(graph);
          graph.clear();
          this.graph.fromJSON(jas);

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
        console.log(ar);
        reader.readAsText(ar);




      });
    });



    // evento del grafo que se activa cuando se agrega un elemento al lienzo
    graph.on('add', (cell, collection, opt) => {
      // se verifica si el objeto agregado viene de un stencil 
      // tambien se comprueba que el tipo de elemento sea imagen ya que 
      // estos son utilizados para guardar las referencias correspondientes
      // a los diagramas obtenidos de la base de datos 
      // se
      if (opt.stencil && cell.attributes.type === 'standard.Image') {
        // se itera sobre 
        for (let element of this.objectMaps) {
          if (cell.attributes.prop.mongoID === element._id) {

            graph.clear();
            graph.fromJSON(element.grafo);
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
          const blob = new Blob([JSON.stringify(graph.toJSON())], { type: 'text/plain;charset=utf-8' });
          saveAs(blob, 'diagrama.json');
          alertify.success('archivo descargado');
        });
      });

    });

    toolbar.render();

    // evento que permite cambiar el tamano de un elemento del diagrama
    paper.on('cell:pointerup', (cellView) => {
      // We don't want to transform links.
      if (cellView.model instanceof dia.Link) { return; }

      const freeTransform = new ui.FreeTransform({ cellView });
      freeTransform.render();
    });


    // evento para crear un inspector cada que se hace click en algun elemento del diagrama
    paper.on('element:pointerclick', (elementView) => {
      if (this.globalInspector) {
        this.globalInspector.remove();
      }

      this.globalInspector = aux.createInspector(elementView);
    });

    const rca = new shapes.standard.Rectangle({
      ports: {

      }
    });

    const rc = new shapes.devs.Model({
      attrs: {
        ".label": { text: 'hola' }
      },
      inPorts: ['in1', 'in2'],
      outPorts: ['out1'],
      ports: {
        groups: {
          'in': {
            attrs: {
              '.port-body': {
                fill: '#16A085'
              }
            }
          },
          'out': {
            attrs: {
              '.port-body': {
                fill: 'red'
              }
            }
          }
        }
      }

    });

    rc.resize(150, 150);
    const port = {
      group: 'in',
      attrs: {
        '.port-body': {
          fill: '#16A085'
        }
      }
    };
    rc.addPort(port);

    //graph.addCell(rc);

    var connect = function (source, sourcePort, target, targetPort) {

      var link = new shapes.devs.Link({
        source: {
          id: source.id,
          port: sourcePort
        },
        target: {
          id: target.id,
          port: targetPort
        }
      });

      link.addTo(graph).reparent();
    };


    var c1 = new shapes.devs.Coupled({
      attrs: {
        ".body": {
          stroke: '#FEb663',
          strokeWidth: 6,
          rx: 6,
          ry: 6
        },
        ".label": {
          fill: '#FEB663',
          fontSize: 16,
          fontWeight: 800,
        },
        subbody: {
          refX: '10%',
          refY: '15%',
          refWidth: '80%',
          refHeight: '70%',
          fill: 'black',
          stroke: 'black'
        },

      },
      markup: [{
        tagName: 'rect',
        selector: '.body'
      },
      {
        tagName: 'text',
        selector: '.label'
      },

      {
        tagName: 'rect',
        selector: 'subbody'
      },
      ],

      ports: {
        groups: {
          'in': {
            attrs: {
              '.port-body': {
                fill: 'blue',
                stroke: '#ffffff',
                strokeWidth: '3px'
              }
            }
          }
        }
      },

      position: {
        x: 230,
        y: 50
      },
      size: {
        width: 300,
        height: 300
      }

    });

    c1.set('inPorts', ['in']);
    c1.set('outPorts', ['out 1', 'out 2']);

    graph.addCell(c1);



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


  updateStencilDB(stencil: ui.Stencil, group: string) {
    this.dbObjects = [];
    this.objectMaps = {};
    this.mongo.getRegistros().subscribe((data: Array<any>) => {
      this.objectMaps = data;
      for (let element of data) {
        let imgAux = new shapes.standard.Image({
          size: { width: 100, height: 100 },
          position: { x: 10, y: 10 },
          attrs: {
            image: {
              xlinkHref: element.image
            },
          },
          prop: { mongoID: element._id }
        });

        this.dbObjects.push(
          imgAux
        );
      }

      stencil.load({
        [group]: this.dbObjects,
      });
    }, (err) => { alertify.error('No se han podido cargar los registros de la base de datos'); });
  }


}
