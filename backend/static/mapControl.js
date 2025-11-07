(() => {
  let mapInstance = null;
  let currentTarget = null;
  let currentPositionLayer = null;
  
  // Wait for OpenLayers to load
  function waitForOL(callback) {
    if (window.ol) {
      console.log("✅ OpenLayers loaded");
      callback();
    } else {
      console.log("⏳ Waiting for OpenLayers...");
      setTimeout(() => waitForOL(callback), 100);
    }
  }

  console.log("✅ mapControl.js loaded");
  
  // Initialize when OL is ready
  waitForOL(() => {
    const targetId = location.hash.slice(1) === "location" ? "mapLoc" : null;
    if (targetId) initMapControl(targetId);
  });

  function createMap(targetId, coords = [121.0437, 14.6760], zoom = 16) {
    return new ol.Map({
      target: targetId,
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM()
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat(coords),
        zoom
      })
    });
  }

  function addPinsToMap(map, coords) {
    const features = coords.map(({ lat, lon }) => new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
    }));
    const vectorSource = new ol.source.Vector({ features });
    const vectorLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: '#ff3' }),
          stroke: new ol.style.Stroke({ color: '#333', width: 2 })
        })
      })
    });
    map.addLayer(vectorLayer);
    const extent = vectorSource.getExtent();
    map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 19, duration: 1000 });
  }

  function loadAndPinCoords() {
    fetch('http://192.168.1.13/getCoords')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const coords = data.coords;
        if (!coords?.length) {
          console.warn("⚠️ No coordinates received.");
          return;
        }
        console.log("📍 Coordinates received:", coords);
        if (!mapInstance || currentTarget !== 'mapLoc') {
          console.warn("🗺️ Map not ready.");
          return;
        }
        addPinsToMap(mapInstance, coords);
      })
      .catch(error => console.error("❌ Error fetching coordinates:", error));
  }

  function updateMapMarker(lat, lon) {
    if (!mapInstance) return;
    if (currentPositionLayer) {
      mapInstance.removeLayer(currentPositionLayer);
    }
    const markerFeature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
    });
    const vectorSource = new ol.source.Vector({ features: [markerFeature] });
    currentPositionLayer = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: 'red' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
        })
      })
    });
    mapInstance.addLayer(currentPositionLayer);
  }

  function switchMapTarget(newTargetId) {
    const el = document.getElementById(newTargetId);
    if (!el) {
      console.warn(`🚫 Target "${newTargetId}" not found.`);
      return;
    }
    if (!mapInstance) {
      mapInstance = createMap(newTargetId);
      currentTarget = newTargetId;
      if (newTargetId === 'mapLoc') loadAndPinCoords();
    } else if (currentTarget !== newTargetId) {
      mapInstance.setTarget(newTargetId);
      currentTarget = newTargetId;
      setTimeout(() => {
        mapInstance.updateSize();
        if (newTargetId === 'mapLoc') loadAndPinCoords();
      }, 100);
    } else {
      setTimeout(() => mapInstance.updateSize(), 100);
    }
  }

  function trySwitchMap() {
    const target = location.hash.slice(1) === "live" ? "mapLive" :
                   location.hash.slice(1) === "location" ? "mapLoc" : null;
    if (target) switchMapTarget(target);
  }

  // Expose to window for other scripts
  window.switchMapTarget = switchMapTarget;
  window.createMap = createMap;
  window.initMapControl = function initMapControl(targetId = "mapLoc") {
    mapInstance = createMap(targetId);
    currentTarget = targetId;
  }
})();
