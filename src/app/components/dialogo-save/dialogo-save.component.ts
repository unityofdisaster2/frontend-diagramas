import { Component, OnInit, EventEmitter } from '@angular/core';
import * as alertify from 'alertifyjs';

interface Coleccion {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-dialogo-save',
  templateUrl: './dialogo-save.component.html',
  styleUrls: ['./dialogo-save.component.scss']
})
export class DialogoSaveComponent implements OnInit {


  seleccionado: string;
  nombre: string;
  closed: boolean;
  coleccion: Coleccion [] = [
    {value:  'Componentes', viewValue: 'Componentes'},
    {value:  'Subsistemas', viewValue: 'Subsistemas'},
    {value:  'Sistemas', viewValue: 'Sistemas'}
  ];
  parentCOM = new EventEmitter();



  constructor() { }

  ngOnInit(): void {
  }

  onSendValues() {
    if (this.nombre === '' || this.nombre === undefined && !this.seleccionado) {
      alertify.error('ingresar valores en los campos');
    } else if (this.nombre === '' || this.nombre === undefined ){
      alertify.error('ingrese un valor en el nombre');
    } else if (!this.seleccionado) {
      alertify.error('seleccione una coleccion');
    } else {
      this.closed = true;
      this.parentCOM.emit();
    }
  }



}
