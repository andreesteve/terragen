import * as THREE from "three";

/**
 * @param options options to define the terrain.
 * @param options.voronoi the voronoi diagram.
 */
function Terrain(options) {
    this.options = options;
    
    this.borderLineGeometry = null;
    this.mapGeometry = null;
    this.sitesGeometry = null;
}

/**
 * This callback is called for calculating height.
 * @callback calculateHeight
 * @param {number} x coordinate
 * @param {number} y coordinate
 * @return {number} a value between 0 and 1 representing coordinate's height.
 */

/**
 * Build terrain.
 * @param voronoi {voronoi diagram} the voronoi diagram.
 * @param options options to build the terrain.
 * @param options.calculateHeight {calculateHeight} callback to calculate height.
 * @param options.calculateColor {calculateColor} callback to calculate color.
 */
Terrain.prototype.build = function(voronoi, options) {
    options = options || {};
    this.borderLineGeometry = new THREE.Geometry();
    this.mapGeometry = new THREE.Geometry();
    this.sitesGeometry = new THREE.Geometry();

    options = options || {};             
    var calculateHeight = options.calculateHeight || function () { return 0; };
    var calculateColor = options.calculateColor || function (h) { return new THREE.Color(h,h,h); };

    // if we uncomment this we can remove drawing the same edge more than once
    // but we need to solve how to generate height for the borders
    // borders
    // for (var i = 0; i < voronoi.edges.length; i++) {
    //     var edge = voronoi.edges[i];
    //     if (edge) {
    //         this.borderLineGeometry.vertices.push(
    //             new THREE.Vector3(edge[0][0], edge[0][1]),
    //             new THREE.Vector3(edge[1][0], edge[1][1]));
    //     }
    // }

    var polys = voronoi.polygons();

    for (var i = 0; i < polys.length; i++) {
        var poly = polys[i];
        
        // convert vertices to vector3
        // duplicate poly Y coord into Y and Z on final vector as triangulation will only operate on X/Y
        var vertices = poly.map(function (p) { return new THREE.Vector3(p[0], p[1], p[1]); });

        /**
         * BORDER
         */
        for (var j = 0; j < vertices.length - 1; j++) {
            this.borderLineGeometry.vertices.push(vertices[j], vertices[j+1]);
        }
        // close loop
        this.borderLineGeometry.vertices.push(vertices[j], vertices[0]);

        /**
         * SITES
         */
        var site = poly.data;
        var sitePos = new THREE.Vector3(site[0],0, -site[1]);
        this.sitesGeometry.vertices.push(sitePos);
        
        /**
         * MAP
         */
        THREE.ShapeUtils.triangulate(vertices).map((triangle) => {
            var index = this.mapGeometry.vertices.length;
            var normal = new THREE.Vector3(0, 0, 1);
            
            triangle[0].y = calculateHeight(triangle[0].x, triangle[0].z);
            triangle[1].y = calculateHeight(triangle[1].x, triangle[1].z);
            triangle[2].y = calculateHeight(triangle[2].x, triangle[2].z);

            var height = (triangle[0].y + triangle[1].y + triangle[2].y) / 3;            
            var color = calculateColor(height);

            // reverse vertices indexes given we are moving from X-Y lefthanded to X-Y-Z righthanded
            var face = new THREE.Face3(index+2, index+1, index+0, normal, color);
            
            this.mapGeometry.vertices.push(triangle[0], triangle[1], triangle[2]);
            this.mapGeometry.faces.push(face);
        });
    }
};

Terrain.prototype.createMesh = function(options) {
    options = options || {};

    var borderColor = options.borderColor || 0x000000;
    var borderWidth = options.borderWidth || 3;

    var siteSize = options.siteSize || 0.05;
    
    var group = new THREE.Group();

    // BORDER
    var borderMaterial = new THREE.LineBasicMaterial( { color: borderColor, linewidth: borderWidth } );
    var border = new THREE.LineSegments( this.borderLineGeometry, borderMaterial );
    group.add(border);

    // SITES    
    var sites = new THREE.Points(this.sitesGeometry, new THREE.PointsMaterial( { size: siteSize } ) );
    group.add(sites);

    // MAP
    var mapMaterial = new THREE.MeshBasicMaterial( { side: THREE.FrontSide, vertexColors: THREE.FaceColors } );
    var map = new THREE.Mesh(this.mapGeometry, mapMaterial);
    group.add(map);

    return {
        group: group,
        border: border,
        sites: sites,
        map: map
    };
};

export default Terrain;
