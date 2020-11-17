import {NestedTreeControl} from '@angular/cdk/tree';
import { Component, Input, AfterViewInit, Output, EventEmitter } from '@angular/core';
import {MatTreeNestedDataSource} from '@angular/material/tree';
import { OPDNode } from '../../utils/rappid-opm-utils';


@Component({
  selector: 'app-tree-view',
  templateUrl: 'tree-view.component.html',
  styleUrls: ['tree-view.component.scss'],
})
export class TreeViewComponent implements AfterViewInit {
  message = '';
  OPDTREE_DATA: OPDNode [];

  @Input() datosArbol: OPDNode[];
  @Output() eventoNodo = new EventEmitter<OPDNode>();

  // treeControl = new NestedTreeControl<FoodNode>(node => node.children);
  // dataSource = new MatTreeNestedDataSource<FoodNode>();
  treeControl = new NestedTreeControl<OPDNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<OPDNode>();

  updateTree(datos: OPDNode []) {
    this.dataSource.data = null;
    this.dataSource.data = datos;
  }

  enviarNodo(nodo: OPDNode) {
    this.eventoNodo.emit(nodo);
  }





  ngAfterViewInit(): void {
    // this.datosArbol[0].children = [];
    // this.datosArbol[0].children.push({
    //   name: 'hijo',
    //   id: '1',
    //   type: 'opm.object',
    //   level: 1
    // });
    this.dataSource.data = this.datosArbol;
  }





  hasChild = (_: number, node: OPDNode) => !!node.children && node.children.length > 0;
}

