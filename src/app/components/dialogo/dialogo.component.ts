import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as alertify from 'alertifyjs';


@Component({
  selector: 'app-dialogo',
  templateUrl: './dialogo.component.html',
  styleUrls: ['./dialogo.component.scss']
})
export class DialogoComponent implements OnInit {

  tipo: string;
  nombre: string;
  descripcion: string;
  closed: boolean;
  parentCOM = new EventEmitter();

  constructor(public dialog: MatDialog) {
    this.tipo = '0';
    this.nombre = '';
    this.descripcion = '';
  }


  ngOnInit(): void {
  }

  onSendValues() {
    if (this.nombre === ''){
      alertify.error('ingrese un valor en el nombre');
    }
    else if (this.descripcion === '') {
      alertify.error('ingrese una descripcion');
    }
    else {
      this.closed = true;
      this.parentCOM.emit();
    }
  }


}
