import * as THREE from "three";

var CellType = {
    Water: 0,
    Land: 1
};

/**
 * @param options options to define the terrain.
 * @param options.voronoi the voronoi diagram.
 */
function Terrain(options) {
    this.options = options;
    
    this.borderLineGeometry = null;
    this.mapGeometry = null;
    this.sitesGeometry = null;
    this.edges = null;
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
    this.edges = this.borderLineGeometry.vertices;
    
    options = options || {};             
    var calculateHeight = options.calculateHeight || function () { return 0; };
    var calculateColor = options.calculateColor || function (h) { return new THREE.Color(h,h,h); };

    /**
     * cells[site.index] points to the cell associated to the site
     *
     * cell.site - pointer to site
     * cell.halfedges - [] of indexes to voronoi.edges 
     *
     * site.index - site index on original data input array
     * site.data - [x,y] site position
     *
     * edge is [[x0,y0], [x1,y1]] with additional properties:
     * edge.left - pointer to left site of the edge
     * edge.right - pointer to right site of the edge
     *
     * Additional properties that build adds
     * cell.height - a value between 0,1 for the height
     * cell.type - CellType value
     * edge.slope - 
     */
    var cells = voronoi.cells;

    /**
     * BORDER
     */
    var vedges = voronoi.edges;    
    for (let i = 0; i < vedges.length; i++) {
        var edge = vedges[i];
        if (edge) {
            edge.start = new THREE.Vector3(edge[0][0], calculateHeight(edge[0][0], edge[0][1]), edge[0][1]);
            edge.end =   new THREE.Vector3(edge[1][0], calculateHeight(edge[1][0], edge[1][1]), edge[1][1]);
            this.edges.push(edge.start, edge.end);
        }
    }
    
    for (let i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var site = cell.site.data;

        var vertices = cell.halfedges.map((edgeIndex) => {
            var e = voronoi.edges[edgeIndex];
            var v = e.left !== cell.site ? e.end : e.start;
            // triangulation will happen on x-y only
            return new THREE.Vector3(v.x, v.z, v.z);
        });
        
        /**
         * MAP
         */
        let color = null;
        let height = null;

        THREE.ShapeUtils.triangulate(vertices).map((triangle) => {
            var index = this.mapGeometry.vertices.length;
            
            triangle[0].y = calculateHeight(triangle[0].x, triangle[0].z);
            triangle[1].y = calculateHeight(triangle[1].x, triangle[1].z);
            triangle[2].y = calculateHeight(triangle[2].x, triangle[2].z);

            height = (triangle[0].y + triangle[1].y + triangle[2].y) / 3;
            color = color || calculateColor(height);

            // reverse vertices indexes given we are moving from X-Y lefthanded to X-Y-Z righthanded
            var face = new THREE.Face3(index+2, index+1, index+0);
            face.color = color;
            
            this.mapGeometry.vertices.push(triangle[0], triangle[1], triangle[2]);
            this.mapGeometry.faces.push(face);
        });

        // set additional properties to cell
        cell.height = height;
        
        /**
         * SITES
         */
        var sitePos = new THREE.Vector3(site[0], height, site[1]);
        this.sitesGeometry.vertices.push(sitePos);
    }

    this.mapGeometry.computeFaceNormals();
};

Terrain.prototype.createMesh = function(options) {
    options = options || {};

    var borderColor = options.borderColor || 0x000000;
    var borderWidth = options.borderWidth || 1;

    var siteSize = options.siteSize || 0.005;
    
    var group = new THREE.Group();

    var epsilonh = 0.001;
    
    // BORDER
    var borderMaterial = new THREE.LineBasicMaterial( { color: borderColor, linewidth: borderWidth } );
    var border = new THREE.LineSegments( this.borderLineGeometry, borderMaterial );
    border.position.y += epsilonh;
    group.add(border);

    // SITES    
    var sites = new THREE.Points(this.sitesGeometry, new THREE.PointsMaterial( { size: siteSize } ) );
    sites.position.y += epsilonh;
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
