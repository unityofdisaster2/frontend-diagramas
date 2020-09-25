import { OnInit, Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { dia, ui, shapes, setTheme } from '@clientio/rappid';
import { MongoService } from './services/mongo.service';

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
  private keyboard: ui.Keyboard;
  private paper: dia.Paper;
  private scroller: ui.PaperScroller;
  private stencil: ui.Stencil;
  private stencilDB: ui.Stencil;
  private toolbar: ui.Toolbar;


  constructor(private mongo: MongoService){}



  public ngOnInit(): void {

    // se establece tema de rappid
    setTheme('modern');

    // declaracion de grafo que contendra la estructura
    // del diagrama
    const graph = this.graph = new dia.Graph();

    // objeto utilizado para capturar eventos de teclado
    const keyboard = this.keyboard = new ui.Keyboard();


    // declaracion de lienzo que contendra los elementos de diagrama
    const paper = this.paper = new dia.Paper({
      gridSize: 10,
      drawGrid: true,
      model: graph, // Set graph as the model for paper
      defaultLink: (elementView, magnet) => {
        return new shapes.standard.Link({
          attrs: { line: { stroke: 'white' } }
        });
      },
      async: true,
      embeddingMode: true,
    });
    const selection = new ui.Selection({
      paper,
      graph
    });


    // evento para poder mover el lienzo mediante un drag del cursor
    paper.on({
      'blank:pointerdown': (evt, x, y) => {
        if (keyboard.isActive('shift', evt)) {
          selection.startSelecting(evt);
        } else {
          selection.cancelSelection();
          scroller.startPanning(evt);
        }
      }
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
    const rect = new shapes.standard.Rectangle({
      size: { width: 250, height: 100 },
      attrs: {
        body: {
          fill: '#FFFFFF',
          stroke: '#70E483',
          strokeWidth: 3
        }
      },
    });

    // primer acercamiento al elemento que define la figura para los estados opm
    const state = new shapes.standard.Rectangle({
      size: { width: 150, height: 50 },
      attrs: {
        body: {
          fill: '#FFFFFF',
          stroke: '#BFBF80',
          strokeWidth: 3,
          rx: 10,
          ry: 10
        },
      },
    });


    // primer acercamiento al elemento que define la figura para los procesos OPM
    const circ = new shapes.standard.Ellipse({
      size: { width: 400, height: 250 },
      attrs: {
        body: {
          fill: '#FFFFFF',
          stroke: '#4FC8FE',
          strokeWidth: 3
        }
      },
    });


    // declaracion de paleta donde se mostraran diagramas alojados en base de datos
    // y que pueden ser arrastrados para formar parte de un nuevo sistema.
    const stencilDB = this.stencilDB = new ui.Stencil({
      paper: scroller,
      label: 'memoria',
      scaleClones: true,
      width: 200,
      dropAnimation: true,
      groupsToggleButtons: true,
      groups: {
        g1: { index: 1, label: 'grupo1', height: 300 },

      },
      layout: true
    });

    stencilDB.render();

    // carga de elementos. Probablemente cuando ya este listo se puede usar
    // un servicio para cargar los JSON desde la base de datos y asociarlos a
    // una imagen o vista previa


    stencilDB.load({ g1: [rect, circ, state] });


    // declaracion de paleta que contendra los elementos basicos de OPM
    // tal vez despues se pueda crear uno para links
    const stencil = this.stencil = new ui.Stencil({
      paper: scroller,
      label: 'test',
      scaleClones: true,
      width: 200,
      groups: {
        myShapesGroup1: { index: 1, label: ' Categoria 1', height: 200 },
        myShapesGroup2: { index: 2, label: ' Categoria 2', height: 200 }
      },
      dropAnimation: true,
      groupsToggleButtons: true,
      search: {
        '*': ['type', 'attrs/label/text']
      },
      // se utiliza layout para que los elementos no se muestren de forma desordenada
      layout: true  // Use default Grid Layout
    });

    stencil.render();

    const arreglo = [];
    for (let a = 0; a < 10; a++){
      arreglo.push(
        new shapes.standard.Image({
          size: {width: 100, height: 100},
          position: {x: 10, y: 10},
          attrs: {
            image: {
              xlinkHref: 'assets/images/logo-mongo.png'
            }
          }
        })
      );
    }

    stencil.load({ 
      myShapesGroup1: [arreglo[0], arreglo[1], arreglo[2], arreglo[3]],
    myShapesGroup2: [arreglo[4], arreglo[5], arreglo[6], arreglo[7]] });


    // barra de herramientas superior
    const toolbar = this.toolbar = new ui.Toolbar({
      tools: [
        { type: 'zoomIn', name: 'zoomIn', },
        { type: 'zoomOut', name: 'zoomOut', },
        { type: 'zoomToFit', name: 'fit' },

        { type: 'separator' },
        { type: 'toggle', name: 'toggle', label: '' },
        { type: 'separator' },  // also possible, use defaults
        { type: 'inputText' },
        { type: 'button', name: 'ok', text: 'Ok' },
        { type: 'button', name: 'cancel', text: 'Cancel' },
        { type: 'separator' }
      ],
      // se utilizan las referencias para que los botones tengan interaccion con 
      // el lienzo u otros elementos
      references: {
        paperScroller: scroller
      }
    });

    // evento para mostrar en consola el grafo en formato json
    // cuando se da click en el boton ok
    toolbar.on('ok:pointerclick', (event) => {
      console.log(graph.toJSON());
      this.mongo.getQuery('registros').subscribe((valor) => {
        console.log(valor);
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
      
      // se crea inspector que permite modificar valores del elemento seleccionado
      ui.Inspector.create('.inspector-container', {
        cell: elementView.model,
        inputs: {
          'attrs/label/text': {
            type: 'text',
            label: 'Label',
            group: 'basic',
            index: 1
          },
          level: {
            type: 'range',
            min: 1,
            max: 10,
            unit: 'x',
            defaultValue: 6,
            label: 'Level',
            group: 'advanced',
            index: 2
          }
        },
        groups: {
          basic: {
            label: 'Basic',
            index: 1
          },
          advanced: {
            label: 'Advanced',
            index: 2
          }
        }
      });
    });


    const CustomTextElement = dia.Element.define('examples.CustomTextElement', {
      attrs: {
        label: {
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          fontSize: 48
        },
        c: {
          strokeWidth: 1,
          stroke: '#000000',
          fill: 'rgba(0,0,255,0.3)'
        }
      }
    }, {
      markup: [{
        tagName: 'circle',
        selector: 'c'
      }, {
        tagName: 'text',
        selector: 'label'
      }]
    });

    const element = new CustomTextElement();
    element.attr({
      label: {
        text: 'Hello, World!'
      },
      e: {
        ref: 'label',
        refRx: '50%',
        refRy: '25%',
        refCx: '50%',
        refCy: 0,
        refX: '-50%',
        refY: '25%'
      },
      r: {
        ref: 'label',
        refX: '100%',
        x: -10, // additional x offset
        refY: '100%',
        y: -10, // additional y offset
        refWidth: '50%',
        refHeight: '50%',
      },
      c: {
        ref: 'label',
        refRCircumscribed: '50%',
        // c is already centered at label anchor
      }
    });



    graph.addCell(element);





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