import * as joint from '@clientio/rappid';



// para que rappid detecte las figuras personalizadas es necesario
// crear ya sea un namespace que contenga los elementos definidos o bien
// agregarlo a uno ya existente como el de shapes.standard/devs, etc.

export const opm = {

    // definicion de la figura que representara al elemento objeto
    Object: joint.shapes.devs.Atomic.define('opm.Object', {
        attrs: {
            ".body": {
                refWidth: '100%',
                refHeight: '100%',
                strokeWidth: 4,
                fill: '#FFFFFF',
                stroke: '#62FC6A',
                magnet: true,
                filter: {
                    name: 'dropShadow',
                    args: {
                        dx: 2,
                        dy: 2,
                        blur: 3
                    }
                }
            },
            subbody: {
                refX: '10%',
                refY: '15%',
                refWidth: '80%',
                refHeight: '70%',
                fill: 'transparent',
                stroke: 'transparent'
            },
            '.label': {
                // configuracion para posicionamiento de label dentro del rectangulo

                fontSize: 20,
                fill: '#333333',
                text: 'Objeto'
            },
        },
        markup: [{
            tagName: 'rect',
            selector: '.body',
        },
        {
            tagName: 'rect',
            selector: 'subbody',
        },
        {
            tagName: 'text',
            selector: '.label',
        }],
    }),

    ParentObject: joint.shapes.devs.Coupled.define('opm.ParentObject', {
        
    }),

    // definicion de la figura que representara al elemento proceso
    Process: joint.dia.Element.define('opm.Process', {
        attrs: {
            body: {
                // configuracion para generar un elipse como body
                refRx: '50%',
                refRy: '50%',
                refCx: '1%',
                refCy: 0,
                refX: '50%',
                refY: '50%',
                refWidth: '100%',
                refHeight: '100%',
                fill: '#FFFFFF',
                stroke: '#4FC8FE',
                strokeWidth: 4,
                magnet: true,
            },
            subbody: {
                refRx: '40%',
                refRy: '35%',
                refCx: '1%',
                refCy: 0,
                refX: '50%',
                refY: '50%',
                refWidth: '100%',
                refHeight: '100%',
                fill: 'transparent',
                stroke: 'transparent',
            },
            label: {
                text: 'Proceso',
                fontSize: 20,
                textVerticalAnchor: 'middle',
                textAnchor: 'middle',
                refX: '50%',
                refY: '50%',
            }
        },
        markup: [
            {
                tagName: 'ellipse',
                selector: 'body'
            },
            {
                tagName: 'ellipse',
                selector: 'subbody'
            },
            {
                tagName: 'text',
                selector: 'label'
            }

        ],
    }),

    // definicion de la figura que representara a la conexion result-consumption de opm
    ResultConsumptionLink: joint.dia.Link.define('opm.ResultConsumptionLink', {
        attrs: {
            line: {
                connection: true,
                stroke: 'black',
                strokeWidth: 2,
                targetMarker: {
                    type: 'path',
                    fill: 'white',
                    stroke: 'black',
                    // instrucciones de svg path para generar una flecha
                    d: 'M 20 -10 0 0 20 10 10 0 z'
                }
            },
            wrapper: {
                connection: true,
                strokeWidth: 10,
                strokeLinejoin: 'round'
            }
        }
    }, {
        markup: [{
            tagName: 'path',
            selector: 'wrapper',
            attributes: {
                fill: 'none',
                cursor: 'pointer',
                stroke: 'transparent'
            }
        }, {
            tagName: 'path',
            selector: 'line',
            attributes: {
                fill: 'none',
            }
        }]
    }),

};


export const shapeConfig = {
    inPortProps: {
        attrs: {
            '.port-body': {
                fill: '#FFF82D',
                stroke: '#62FC6A',
            }
        }
    },
    outPortProps: {
        attrs: {
            '.port-body': {
                fill: '#E644FF',
                stroke: '#62FC6A'
            }
        }
    }
};

