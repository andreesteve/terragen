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

window.addEventListener("keyup", function (e) {
    var char = String.fromCharCode(e.keyCode);
    if (char == 'R') {
        newVoronoi();
    }
});

//var rand = seedrandom("andre", { global: true });

var container = document.body;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 1000 );

camera.position.set( 0, -2, 6 );
camera.lookAt(new THREE.Vector3(0, 0, 0));
scene.add( camera );

var light = new THREE.PointLight( 0xffffff, 0.8 );
camera.add( light );

var renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setClearColor( 0xf0f0f0 );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

var stats = new Stats();
container.appendChild( stats.dom );

function Settings() {
    this.seed = 0;
    this.islands = 5;
    this.sites = 4000;
    this.showPolygons = true;
    this.showSites = false;
    this.flat = false;
    this.seaLevel = 0.3;
    this.heightFrequency = 2.6;
}
var gui = new dat.GUI();
var settings = new Settings();
gui.add(settings, "sites", 0).step(50).onFinishChange(newVoronoi);
gui.add(settings, "islands", 0).step(1);
gui.add(settings, "heightFrequency").step(0.01).onFinishChange(newVoronoi);
gui.add(settings, "showPolygons").onFinishChange(function(v) { if (mesh) { mesh.border.visible = v; } });
gui.add(settings, "showSites").onFinishChange(function(v) { if (mesh) { mesh.sites.visible = v; } });;
gui.add(settings, "flat");
gui.add(settings, "seaLevel", 0, 1).step(0.01).onFinishChange(newVoronoi);


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
function newVoronoi() {
    var t0 = performance.now();

    if (mesh) {
        scene.remove(mesh.group);
    }

    var heightScale = 0.3;
    
    var t = new Terrain();
    var voronoiDiagram = createVoronoi(settings.sites);
    var noiseGen = new noise({
        frequency: settings.heightFrequency,
        max: heightScale,
        min: 0,
        octaves: 2
    });
    
    t.build(voronoiDiagram, {
        flat: settings.flat,
        
        calculateHeight: function(x,y) {           
            var h = noiseGen.scaled2D(x, y);
            var l = 0.2;
            
            var p = Math.min(1, x / l, y / l, Math.min(1 - x, l) / l, Math.min(1 - y, l) / l);
            return h * p;        
        },
        
        calculateColor: function(h) {
            var color;
            if (h > settings.seaLevel * heightScale) {
                color = new THREE.Color(0xcccaa1);
            } else {
                color = new THREE.Color(0x8ec0ed);
            }
            return color;
        }
    });

    mesh = t.createMesh();
    mesh.border.visible = settings.showPolygons;
    mesh.sites.visible = settings.showSites;
    
    scene.add(mesh.group);

    var scale = 4.5;
    mesh.group.scale.set(scale,scale,scale);
    mesh.group.position.set(-2.5, -2.2, 0);    
    
    var t1 = performance.now();
    console.log("Voronoi generation took " + (t1 - t0) + " ms.");
}

newVoronoi();

function render() {
    stats.begin();
	renderer.render( scene, camera );
    stats.end();

    requestAnimationFrame( render );
}
render();
