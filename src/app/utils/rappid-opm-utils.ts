import { dia, ui, shapes } from '@clientio/rappid';


export class RappidOPMUtils {
    // podemos guardaar aqui todas las definiciones de la ui para que no todo se encuentre
    // en la clase principal

    constructor() {}



    /**
     * funcion para crear un elemento Inspector personalizado para los tipos de
     * figura que forman parte del lenguaje establecido. Dichas figuras pueden ser
     * opm.Process u opm.Object
     * @param elementView elemento que hace referencia a la figura que se haya seleccionado en el linzo
     * @returns Inspector personalizado
     */
    createInspector(elementView: dia.ElementView): ui.Inspector {

        // se verifica en los atributos si la figura seleccionada es un proceso o un objeto
        if (elementView.model.attributes.type === 'opm.Process') {
            return ui.Inspector.create('.inspector-container', {
                cell: elementView.model,
                inputs: {
                    'attrs/label/text': {
                        type: 'text',
                        label: 'name',
                        group: 'processGroup',
                        index: 2

                    },
                    // creacion de estructura personalzizada para un proceso
                    parametros: {
                        text: {
                            type: 'list',
                            label: 'requirements',
                            group: 'paramGroup',
                            index: 4,
                            item: {
                                type: 'object',
                                label: 'requirements',
                                properties: {
                                    name: { type: 'text', label: 'name' },
                                    nomenclature: { type: 'text', label: 'nomenclature' }
                                }
                            }
                        },
                    }
                },
                groups: {
                    processGroup: {
                        label: 'Proceso',
                        index: 1
                    },
                    paramGroup: {
                        label: 'Lista de parametros',
                        index: 3
                    }
                }
            });
        } else if (elementView.model.attributes.type === 'opm.Object') {
            return ui.Inspector.create('.inspector-container', {
                cell: elementView.model,
                inputs: {
                    'attrs/label/text': {
                        type: 'text',
                        label: 'nombre',
                        index: 2,
                        group: 'objectGroup'
                    },
                    // tipo de componente
                    tipo: {
                        type: 'select',
                        label: 'type',
                        index: 3,
                        options: ['component', 'matEq', 'cat1', 'cat2', 'cat3'],

                        group: 'objectGroup'
                    },

                    // lista de parametros del objeto
                    parametros: {
                        // se utiliza el tipo de elemento lista para que si es requerido
                        // se agreguen tantos parametros como sea necesario
                        type: 'list',
                        label: 'parametros',
                        item: {
                            // se agrega como item de la lista un objeto que contiene
                            // varios campos
                            type: 'object',
                            properties: {
                                name: { type: 'text', label: 'name' },
                                type: { type: 'text', label: 'type' },
                                kind: { type: 'text', label: 'kind' },
                                constraint: {
                                    type: 'select',
                                    options: ['minmax', 'table'],
                                    label: 'constraint'
                                },
                                minmax: {
                                    type: 'object',
                                    label: 'valor maximo y minimo',
                                    // el parametro minmax solo se mostrara cuando
                                    // el select de constraint tenga el valor minmax
                                    when: {
                                        eq: {
                                            'parametros/${index}/constraint': 'minmax'
                                        }
                                    },
                                    properties: {
                                        min: { type: 'number', label: 'min' },
                                        max: { type: 'number', label: 'max' },
                                    },

                                },
                                table: {
                                    type: 'text',
                                    label: 'table',
                                    // solo se mostrara este parametro cuando el select
                                    // de constraint tenga el valor de table
                                    when: {
                                        eq: {
                                            'parametros/${index}/constraint': 'table'
                                        }
                                    }
                                },
                                // campos adicionales del item
                                description: { type: 'textarea', label: 'descripcion' },
                                nomenclature: { type: 'text', label: 'nomenclature' },
                                unit: { type: 'text', label: 'unit' },
                                max: { type: 'text', label: 'max' },


                            },
                            group: 'elementGroup'
                        },
                        index: 5,
                        group: 'paramGroup'

                    },
                },
                groups: {
                    // se crean grupos para mostrar de forma ordenada el formulario del inspector
                    paramGroup: {
                        label: 'lista de parametros',
                        index: 4
                    },
                    objectGroup: {
                        label: 'Objeto',
                        index: 1
                    },
                    elementGroup: {
                        label: 'listElement',
                        index: 8
                    }
                }
            });
        }
    }

    createInoutInspector(elementView: dia.ElementView): ui.Inspector {
        return ui.Inspector.create('.inspector-container', {
            cell: elementView.model,
            inputs: {
                'attrs/label/text': {
                    type: 'text',
                    label: 'nombre',
                    index: 2,
                    group: 'objectGroup'
                },
            },
            groups: {
                // se crean grupos para mostrar de forma ordenada el formulario del inspector
                paramGroup: {
                    label: 'lista de parametros',
                    index: 4
                },
                objectGroup: {
                    label: 'Salidas',
                    index: 1
                },
                elementGroup: {
                    label: 'listElement',
                    index: 8
                }
            }
        });
    }

}
