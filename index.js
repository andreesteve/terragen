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

    var borderPoints = [];
    var mapGeometry = new THREE.Geometry();
    var mapMaterials = {
        land: { index: 0 , material: new THREE.MeshPhongMaterial( { color: 0xcccaa1, side: THREE.DoubleSide } ) },
        sea: { index: 1, material: new THREE.MeshPhongMaterial( { color: 0x8ec0ed, side: THREE.DoubleSide } ) }
    };
    var mapMaterial = new THREE.MultiMaterial( [ mapMaterials["land"].material, mapMaterials["sea"].material ] );

    var sitesGeometry = new THREE.Geometry();
    
    voronoiPolys.map(
        function(poly, i) {
            // convert vertices to vector3
            var vertices = poly.map(function (p) { return new THREE.Vector3(p[0], p[1]); });

            // push vertices to border points
            for (var i = 0; i < vertices.length - 1; i++) {
                borderPoints.push(vertices[i], vertices[i+1]);
            }
            // close loop
            borderPoints.push(vertices[i], vertices[0]);

            // get site position
            var site = poly.data;
            var sitePos = new THREE.Vector3(site[0],site[1], 0);
            var isLand = false;
            sitesGeometry.vertices.push(sitePos);
            
            continents.map(function (c) {
                isLand = c.center.distanceTo(sitePos) < c.size || isLand;
            });

            var materialName = isLand ? "land" : "sea";
            var materialIndex = mapMaterials[materialName].index;

            // triangulate polygons for rendering
            THREE.ShapeUtils.triangulate(vertices).map(function (triangle) {
                var index = mapGeometry.vertices.length;
                var normal = new THREE.Vector3(0, 0, 1);
                var face = new THREE.Face3(index, index+1, index+2, normal);
                face.materialIndex = materialIndex;
                    
                mapGeometry.vertices.push(triangle[0], triangle[1], triangle[2]);
                mapGeometry.faces.push(face);
            });
        });

    var borderLineGeometry = new THREE.Geometry();
    borderLineGeometry.vertices = borderPoints;

    var lineMaterial = new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 3 } );
    var borderLine = new THREE.LineSegments( borderLineGeometry, lineMaterial );
    borderLine.position.set(0,0,0.000001);
    borderLine.visible = settings.showPolygons;
    group.add( borderLine );

    var mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
    group.add(mapMesh);   
    
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
