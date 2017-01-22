import * as THREE from "three";
import Stats from "stats.js";
import * as d3 from "d3";
import seedrandom from "seedrandom";
import * as dat from "exdat";

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

camera.position.set( 0, 0, 5 );
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
    this.sites = 1000;
    this.showPolygons = true;
    this.showSites = true;
}
var gui = new dat.GUI();
var settings = new Settings();
gui.add(settings, "sites", 0).step(50);
gui.add(settings, "islands", 0).step(1);
gui.add(settings, "showPolygons");
gui.add(settings, "showSites");

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

var vGroup;
function newVoronoi() {
    var t0 = performance.now();

    if (vGroup) {
        scene.remove(vGroup);
        vGroup = null;
    }
    
    var voronoiDiag = createVoronoi(settings.sites);
    var voronoiPolys = voronoiDiag.polygons();
    
    var lineMaterial = new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 3 } );
    
    var group = new THREE.Group();
    group.position.set(-2.5, -2.2, 0);
    var scale = 4.5;
    group.scale.set(scale,scale,scale);
    scene.add(group);
    
    var continents = [];
    for (var i = 0; i < settings.islands; i++) {
        continents.push({
            center: new THREE.Vector3(Math.random(), Math.random()),
            size: Math.random() * 0.4
        });
    }
    
    voronoiPolys.map(
        function(poly, i) {
            var shape = new THREE.Shape(poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
            
            var s = poly.data;
            var pos = new THREE.Vector3(s[0],s[1], 0);
            var isLand = false;
            
            continents.map(function (c) {
                isLand = c.center.distanceTo(pos) < c.size || isLand;
            });
        
            var color = isLand ? 0xcccaa1 : 0x8ec0ed;
            
            var flat = new THREE.MeshPhongMaterial( { color: color, side: THREE.DoubleSide } );
            var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), flat);
            
            var points = shape.createPointsGeometry();
            var line = new THREE.Line( points, lineMaterial );
            line.position.set(0,0,0.000001);
            line.visible = settings.showPolygons;
            
            group.add( mesh );
            group.add( line );
        });
    
    var sitesGeometry = new THREE.Geometry();
    Array.prototype.push.apply(sitesGeometry.vertices, voronoiDiag.sites.map(function(s) {
        return new THREE.Vector3(s[0], s[1], 0);
    }));
    
    var sitesPoints = new THREE.Points( sitesGeometry, new THREE.PointsMaterial( { size: 0.05 } ) );
    sitesPoints.visible = settings.showSites;
    group.add(sitesPoints);

    vGroup = group;

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
