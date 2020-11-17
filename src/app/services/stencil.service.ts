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

  updateStencilDB(imageArray: shapes.standard.Image[], dataMap: any, stencil: ui.Stencil, mongo: any) {
    imageArray = [];
    const dbGroups = {Componentes: [], Subsistemas: [], Sistemas: []};
    dataMap = {};

    // se realiza una peticion para obtener todos los registros

    mongo.getRegistros().subscribe((data: Array<any>) => {

      dataMap = data;
      for (const element of data) {
        // se extrae la imagen que contiene cada elemento de la base de datos
        // y se crea una figura de rappid
        const imgAux = new shapes.standard.Image({
          size: { width: 100, height: 100 },
          position: { x: 10, y: 10 },
          attrs: {
            image: {
              xlinkHref: element.image
            },
          },
          // se asocia el id que le da mongo con la figura para su futura ubicacion
          prop: { mongoID: element._id }
        });

        dbGroups[element.group].push(imgAux);


        imageArray.push(
          imgAux
        );
      }
      // se cargan las figuras en el grupo ingresado
      // nota: esto debe cambiar y lo ideal seria que en la base
      // cada registro tenga su propio grupo y aqui organizar por coleccion
      stencil.load({
        Componentes: dbGroups.Componentes,
        Subsistemas: dbGroups.Subsistemas,
        Sistemas: dbGroups.Sistemas,
      });
    }, (err) => { alertify.error('No se han podido cargar los registros de la base de datos'); });

  }
}
