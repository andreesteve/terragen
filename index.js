import * as THREE from "three";
import Stats from "stats.js";
import * as d3 from "d3";
import seedrandom from "seedrandom";
import * as dat from "exdat";
import noise from "fast-simplex-noise";
import Terrain from "./lib/terrain.js";

var style = document.createElement("style");
style.type = "text/css";
// TODO remove overflow hidden from body
style.appendChild(document.createTextNode("body {margin: 0; overflow:hidden}\n canvas {width:100%; height: 100%;}"));

document.head.appendChild(style);

function walk(cells, edges, cell, distance) {
    for (var i = 0; i < cell.faces.length; i++) {
        cell.faces[i].color.setRGB(1, 0, 0);
    }
    
    for (var i = 0; i < cell.halfedges.length; i++) {
        var edge = edges[cell.halfedges[i]];
        var thisSite = cell.site;
        var neighboorSite = edge.left == cell.site ? edge.right : edge.left;

        if (neighboorSite) {
            var neighboorCell = cells[neighboorSite.index];
            var neighboorDistance = new THREE.Vector2(thisSite[0] - neighboorSite[0], thisSite[1] - neighboorSite[1]).length();

            if (neighboorDistance <= distance) {
                walk(cells, edges, neighboorCell, distance - neighboorDistance);
            }
        }
    }
}

window.addEventListener("keyup", function (e) {
    var char = String.fromCharCode(e.keyCode);
    if (char == 'R') {
        newVoronoi();
    } else if (char == 'T') {
        var x = Math.random(), y = Math.random();
        var r = 0.05;
        
        if (map) {
            var site = map.voronoi.find(x, y);
            if (site) {
                var cell = map.voronoi.cells[site.index];
                walk(map.voronoi.cells, map.voronoi.edges, cell, r);
                mesh.map.geometry.colorsNeedUpdate = true;
            }
        }
    }
});

var lastMouse;
var cameraTarget = new THREE.Vector3(0, 0, 0);
window.addEventListener("mousemove", function (e) {

    e.preventDefault();

    if ( e.buttons == 4 ) {
        var diff = cameraTarget.clone().sub(camera.position);
        diff.y = 0;
        var radious = diff.length();

        if (!lastMouse) {
            lastMouse = { x:e.clientX, y:e.clientY, phi: camera.position.angleTo(new THREE.Vector3(0,0,1)), theta: Math.asin(camera.position.x / radious) };
        }
        
        var theta = lastMouse.theta + ( ( e.clientY - lastMouse.y ) * Math.PI * 0.01 );
        var phi = lastMouse.phi + ( ( e.clientX - lastMouse.x ) * 0.5 );

        camera.position.x = radious * Math.sin( theta );
        camera.position.z = radious * Math.cos( theta );

        camera.lookAt(cameraTarget);
        camera.updateMatrix();
    } else {
        lastMouse = null;
    }
});

window.addEventListener("wheel", function (e) {
    var direction = cameraTarget.clone().sub(camera.position);
    var len = direction.length();
    direction.normalize();
    camera.position.add(direction.multiplyScalar(e.deltaY * -0.01 * Math.min(1, Math.pow(len, 5))));
});

//var rand = seedrandom("andre", { global: true });

var container = document.body;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1000 );

camera.position.set( 0, 2, -2 );
camera.lookAt(cameraTarget);
scene.add( camera );

var light = new THREE.PointLight( 0xffffff, 0.8 );
camera.add( light );

var grid = new THREE.GridHelper(2, 20);
scene.add(grid);

var renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setClearColor( 0xf0f0f0 );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

var stats = new Stats();
container.appendChild( stats.dom );

var RENDER = {
    biome: 0,
    height: 1,
    humidity: 2,
    height_X_humidity: 3
}

function Settings() {
    this.seed = 0;
    this.sites = 4000;
    this.showPolygons = false;
    this.showSites = false;
    this.flat = false;
    this.seaLevel = 0.45;
    this.heightFrequency = 1.2;
    this.heightScale = 0.3;
    this.render = "biome";
}
var gui = new dat.GUI();
var settings = new Settings();
gui.add(settings, "sites", 0).step(50).onFinishChange(newVoronoi);
gui.add(settings, "heightScale", 0, 1).step(0.01);
gui.add(settings, "heightFrequency").step(0.01).onFinishChange(newVoronoi);
gui.add(settings, "showPolygons").onFinishChange(function(v) { if (mesh) { mesh.border.visible = v; } });
gui.add(settings, "showSites").onFinishChange(function(v) { if (mesh) { mesh.sites.visible = v; } });;
gui.add(settings, "flat").onFinishChange(makeFlat);
gui.add(settings, "seaLevel", 0, 1).step(0.01).onFinishChange(newVoronoi);
gui.add(settings, "render", Object.keys(RENDER)).onFinishChange(changeRender);

function changeRender() {
    if (!map) {
        return;
    }
    
    var cells = map.voronoi.cells;
    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var faces = cell.faces;

        for (var j = 0; j < faces.length; j++) {
            var f = faces[j];
            var c = f.color;            
            c.setHex(calculateColor(cell.height, cell.site.data[0], cell.site.data[1]).getHex());
        }
    }

    mesh.map.geometry.dynamic = true;
    mesh.map.geometry.colorsNeedUpdate = true;
}

function makeFlat(f) {
    function mf(g) {
        if (!g.old) {
            g.old = g.vertices.map(function(v,i) {
                return v.y;
            });
        }
        g.vertices.map(function (v, i) {
            if (f) { v.y = 0; } else { v.y = g.old[i]; }
        });
        
        g.dynamic = g.verticesNeedUpdate = true;
    }
    
    if (mesh) {
        mf(mesh.map.geometry);
        mf(mesh.sites.geometry);
        mf(mesh.border.geometry);

        if (!f) {
            mesh.map.material = mesh.map.originalMaterial;
        } else {
            mesh.map.material = new THREE.MeshBasicMaterial( { side: THREE.FrontSide, vertexColors: THREE.FaceColors } );
        }
    }
}

var width = 1;
var height = 1;

function createVoronoi(nsites) {
    var width = 1;
    var height = 1;
    var voronoi = d3.voronoi()
        .extent([[0, 0], [width, height]]);
    
    function generateSites() {
        return d3.range(nsites)
            .map(function(d) { return [Math.random() * width, Math.random() * height]; });
    }

    function calculateCentroid(pts) {
        var x = 0;
        var y = 0;
        for (var i = 0; i < pts.length; i++) {
            x += pts[i][0];
            y += pts[i][1];
        }
        return [x/pts.length, y/pts.length];
    }
    
    function loydIteration(sites, iterations) {
        iterations = iterations || 1;
        for (var i = 0; i < iterations; i++) {
            sites = voronoi(sites)
                .polygons()
                .map(calculateCentroid);
        }
        return sites;
    }

    var sites = loydIteration(generateSites(), 1);
    var diag = voronoi(sites);
    diag.sites = sites;
    return diag;
}

var mesh;
var map;

function calculateColor(h, x, y) {
    var color;
    var seaHeight = settings.heightScale * settings.seaLevel;
    var nh = h / (settings.heightScale - seaHeight);
    var p = Math.max(nh, 0.5) / 0xff;

    var humidity =  (noiseGen.raw2D(10+x,10+y) + 1) / 2;

    var biome = {
        water: 0x1a3560,
        scorched: 0x999999,
        bare: 0xbbbbbb,
        tundra: 0xddddbb,
        snow: 0xf8f8f8,
        taiga: 0xccd4bb,
        shrubland: 0xc4ccbb,
        temperateDesert: 0xe4e8ca,
        temperateRainFlorest: 0xa4c4a8,
        temperateDeciduousFlorest: 0xb4c9a9,
        grassland: 0xc4d4aa,
        tropicalRainForest: 0x9cbba9,
        tropicalSeasonalForest: 0xa9cca4,
        subtropicalDesert: 0xe9ddc7                
    };
    
    // first dimension is height, second is humidity
    var colorMap = [
        // very dry,                   dry                 damp                                 wet                       very wet                            drenched
        [ biome.subtropicalDesert, biome.grassland,       biome.tropicalSeasonalForest, biome.tropicalRainForest,        biome.tropicalRainForest,        biome.tropicalRainForest],   // height level 1
        [ biome.temperateDesert,   biome.grassland,       biome.grassland,              biome.temperateDeciduousFlorest, biome.temperateDeciduousFlorest, biome.temperateRainFlorest], // height level 2
        [ biome.temperateDesert,   biome.temperateDesert, biome.shrubland,              biome.shrubland,                 biome.taiga,                     biome.snow],                // height level 3
        [ biome.scorched,          biome.bare,            biome.tundra,                 biome.snow,                      biome.snow,                      biome.snow]                  // height level 4
    ];

    var heb = nh;
    var hub = humidity;

    var hei = heb < 1/4 ? 0 : heb < 2/4 ? 1 : heb < 3/4 ? 2 : 3;
    var hui = hub < 1/6 ? 0 : hub < 2/6 ? 1 : hub < 3/6 ? 2 : hub < 4/6 ? 3 : hub < 5/6 ? 4 : 5;

    switch (RENDER[settings.render]) {
    case RENDER.biome:
        if (nh > 0) {               
            color = new THREE.Color(colorMap[hei][hui]);
        } else {
            // water
            color = new THREE.Color(biome.water);
        }        
        break;
        
    case RENDER.height:
        color = new THREE.Color(nh,nh,nh);
        break;
        
    case RENDER.humidity:
        color = new THREE.Color(hub,hub,hub);
        break;

    case RENDER.height_X_humidity:
        color = new THREE.Color(hub*nh,hub*nh,hub*nh);
        break;
    }
    
    return color;
}

var noiseGen = null;

function newVoronoi() {
    var t0 = performance.now();

    if (mesh) {
        scene.remove(mesh.group);
    }
   
    var t = new Terrain();
    var voronoiDiagram = createVoronoi(settings.sites);
    noiseGen = new noise({
        frequency: settings.heightFrequency,
        max: settings.heightScale,
        min: 0,
        octaves: 8,
        persistence: 0.5
    });

    t.build(voronoiDiagram, {
        
        calculateHeight: function(x,y) {           
            var h = noiseGen.scaled2D(x, y);
            var l = 0.2;
            
            var seaHeight = settings.heightScale * settings.seaLevel;
            var p = Math.min(1, x / l, y / l, Math.min(1 - x, l) / l, Math.min(1 - y, l) / l);
            return Math.max( (h * (Math.pow(p, 0.5) || 0 )) - seaHeight, 0 );
        },
        
        calculateColor: calculateColor
    });

    map = t;
    mesh = t.createMesh({
        mapMaterial: new THREE.MeshPhongMaterial({
            vertexColors: THREE.VertexColors,
            shininess: 5,
            shading: THREE.SmoothShading
        })
    });

    mesh.map.originalMaterial = mesh.map.material;
    
    mesh.border.visible = settings.showPolygons;
    mesh.sites.visible = settings.showSites;  
    
    scene.add(mesh.group);   
    mesh.group.position.set(-0.5, 0, -0.5);
    
    var t1 = performance.now();
    console.log("Voronoi generation took " + (t1 - t0) + " ms.");

    makeFlat(settings.flat);
}

newVoronoi();

function render() {   
    stats.begin();
	renderer.render( scene, camera );
    stats.end();

    requestAnimationFrame( render );
}
render();
