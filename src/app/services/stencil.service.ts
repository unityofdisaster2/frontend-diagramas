import { Injectable } from '@angular/core';
import { dia, ui, shapes } from '@clientio/rappid';
import { MongoService } from './mongo.service';
import * as alertify from 'alertifyjs';
@Injectable({
  providedIn: 'root'
})
export class StencilService {

  constructor(mongo: MongoService) { }

  createOPMStencil(scroller: ui.PaperScroller): ui.Stencil {
    return new ui.Stencil({
      paper: scroller,
      label: 'Object Process Methodology',
      width: 200,
      dropAnimation: true,
      groupsToggleButtons: true,
      groups: {
        OPM: { index: 1, label: 'OPM shapes', height: 300 },

      },
      layout: {
        columnWidth: 150,
        columns: 1,
        rowHeight: 100,
      }
    });
  }

  createDBStencil(scroller: ui.PaperScroller): ui.Stencil {
    return new ui.Stencil({
      paper: scroller,
      label: 'coleccion de diagramas',
      scaleClones: true,
      width: 200,
      groups: {
        Componentes: { index: 1, label: 'Componentes', height: 100 },
        Subsistemas: { index: 2, label: 'Subsistemas', height: 100 },
        Sistemas: { index: 3, label: 'Sistemas', height: 100 }
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


  }




}
