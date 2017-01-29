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

console.log(THREE.OrbitControls);

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

function Settings() {
    this.seed = 0;
    this.sites = 4000;
    this.showPolygons = false;
    this.showSites = false;
    this.flat = false;
    this.seaLevel = 0.45;
    this.heightFrequency = 1.2;
    this.heightScale = 0.3;
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
function newVoronoi() {
    var t0 = performance.now();

    if (mesh) {
        scene.remove(mesh.group);
    }
   
    var t = new Terrain();
    var voronoiDiagram = createVoronoi(settings.sites);
    var noiseGen = new noise({
        frequency: settings.heightFrequency,
        max: settings.heightScale,
        min: 0,
        octaves: 8,
        persistence: 0.5
    });

    var seaHeight = settings.heightScale * settings.seaLevel;
    
    t.build(voronoiDiagram, {
        
        calculateHeight: function(x,y) {           
            var h = noiseGen.scaled2D(x, y);
            var l = 0.2;
            
            var p = Math.min(1, x / l, y / l, Math.min(1 - x, l) / l, Math.min(1 - y, l) / l);
            return Math.max( (h * (Math.pow(p, 0.5) || 0 )) - seaHeight, 0 );
        },
        
        calculateColor: function(h) {
            var color;
            var p = Math.max( h / ( (settings.heightScale - seaHeight) ), 0.5) / 0xff;

            if (h > 0) {
                color = new THREE.Color(p * 0xcc, p * 0xca, p * 0xa1);
            } else {
                color = new THREE.Color(p * 0x8e, p * 0xc0, p * 0xed);
            }
            return color;
        }
    });

    mesh = t.createMesh();
    mesh.border.visible = settings.showPolygons;
    mesh.sites.visible = settings.showSites;  
    makeFlat(settings.flat);
    
    scene.add(mesh.group);

    var scale = 5;
//    mesh.group.rotateX(-Math.PI / 2);   
    mesh.group.position.set(-0.5, 0, -0.5);
//    mesh.group.scale.set(scale,scale,scale);    
    
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
