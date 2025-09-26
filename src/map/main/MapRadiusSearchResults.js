import { useId, useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { formatTime, getStatusColor, formatSpeed, formatDistance } from '../../common/util/formatter';
import { mapIconKey } from '../core/preloadImages';
import { useSelector } from 'react-redux';
import maplibregl from 'maplibre-gl';

const DEVICE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FECA57',
];

// Helper function to create a circle polygon from center point and radius
const createCircleFeature = (longitude, latitude, radiusInMeters, steps = 64) => {
  const coords = [];
  const earthRadius = 6371000; // Earth's radius in meters
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const angleRad = (angle * Math.PI) / 180;
    
    // Calculate offset in degrees
    const latOffset = (radiusInMeters / earthRadius) * (180 / Math.PI);
    const lonOffset = (radiusInMeters / earthRadius) * (180 / Math.PI) / Math.cos((latitude * Math.PI) / 180);
    
    const newLat = latitude + latOffset * Math.cos(angleRad);
    const newLon = longitude + lonOffset * Math.sin(angleRad);
    
    coords.push([newLon, newLat]);
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
};

const MapRadiusSearchResults = ({ results, searchInfo }) => {
  const id = useId();
  const theme = useTheme();

  const devices = useSelector((state) => state.devices.items);
  const [popup, setPopup] = useState(null);

  const resultsSourceId = `${id}-results`;
  const radiusSourceId = `${id}-radius`;
  const centerSourceId = `${id}-center`;
  const resultsLayerId = `${id}-results-layer`;
  const radiusLayerId = `${id}-radius-layer`;
  const centerLayerId = `${id}-center-layer`;

  // Separate effect for popup cleanup to avoid redrawing map layers
  useEffect(() => {
    return () => {
      if (popup) {
        popup.remove();
      }
    };
  }, [popup]);

  useEffect(() => {
    if (!results || !searchInfo) {
      // Clean up any existing layers
      if (map.getLayer(resultsLayerId)) {
        map.removeLayer(resultsLayerId);
      }
      if (map.getLayer(`${radiusLayerId}-outline`)) {
        map.removeLayer(`${radiusLayerId}-outline`);
      }
      if (map.getLayer(radiusLayerId)) {
        map.removeLayer(radiusLayerId);
      }
      if (map.getLayer(centerLayerId)) {
        map.removeLayer(centerLayerId);
      }
      if (map.getSource(resultsSourceId)) {
        map.removeSource(resultsSourceId);
      }
      if (map.getSource(radiusSourceId)) {
        map.removeSource(radiusSourceId);
      }
      if (map.getSource(centerSourceId)) {
        map.removeSource(centerSourceId);
      }
      return;
    }
  
    const uniqueDeviceIds = [...new Set(results.map(r => r.deviceId))];
    const deviceColorMap = {};
    uniqueDeviceIds.forEach((deviceId, index) => {
      deviceColorMap[deviceId] = DEVICE_COLORS[index % DEVICE_COLORS.length];
    });

    // Create circle polygon for search radius
    const radiusFeature = createCircleFeature(
      searchInfo.longitude, 
      searchInfo.latitude, 
      searchInfo.radius
    );

    // Create features for search results with enhanced data
    const resultFeatures = results.map((position) => {
      const device = devices[position.deviceId];
      const deviceColor = deviceColorMap[position.deviceId];
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.longitude, position.latitude],
        },
        properties: {
          id: position.id,
          deviceId: position.deviceId,
          deviceName: device?.name || 'Unknown Device',
          fixTime: formatTime(position.fixTime, 'seconds'),
          speed: position.speed ? formatSpeed(position.speed, 'kmh') : 'N/A',
          altitude: position.altitude ? `${Math.round(position.altitude)}m` : 'N/A',
          accuracy: position.accuracy ? `${Math.round(position.accuracy)}m` : 'N/A',
          address: position.address || 'Address not available',
          deviceColor: deviceColor,
          latitude: position.latitude.toFixed(6),
          longitude: position.longitude.toFixed(6),
        },
      };
    });

    // Add radius circle
    if (map.getSource(radiusSourceId)) {
      map.getSource(radiusSourceId).setData(radiusFeature);
    } else {
      map.addSource(radiusSourceId, {
        type: 'geojson',
        data: radiusFeature,
      });
    }

    if (!map.getLayer(radiusLayerId)) {
      map.addLayer({
        id: radiusLayerId,
        type: 'fill',
        source: radiusSourceId,
        paint: {
          'fill-color': theme.palette.primary.main,
          'fill-opacity': 0.1,
        },
      });
      
      // Add radius outline
      map.addLayer({
        id: `${radiusLayerId}-outline`,
        type: 'line',
        source: radiusSourceId,
        paint: {
          'line-color': theme.palette.primary.main,
          'line-width': 2,
          'line-opacity': 0.6,
        },
      });
    }

    // Add center marker for search location
    const centerFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [searchInfo.longitude, searchInfo.latitude],
      },
      properties: {
        isCenter: true,
      },
    };

    if (map.getSource(centerSourceId)) {
      map.getSource(centerSourceId).setData(centerFeature);
    } else {
      map.addSource(centerSourceId, {
        type: 'geojson',
        data: centerFeature,
      });
    }

    if (!map.getLayer(centerLayerId)) {
      map.addLayer({
        id: centerLayerId,
        type: 'circle',
        source: centerSourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': theme.palette.primary.main,
          'circle-opacity': 0.9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }

    // Add search result markers
    if (resultFeatures.length > 0) {
      const geojsonData = {
        type: 'FeatureCollection',
        features: resultFeatures,
      };

      if (map.getSource(resultsSourceId)) {
        map.getSource(resultsSourceId).setData(geojsonData);
      } else {
        map.addSource(resultsSourceId, {
          type: 'geojson',
          data: geojsonData,
        });
      }

      if (!map.getLayer(resultsLayerId)) {
        map.addLayer({
          id: resultsLayerId,
          type: 'circle',
          source: resultsSourceId,
          paint: {
            'circle-radius': 6,
            'circle-color': ['get', 'deviceColor'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.8,
          },
        });
      }
      
      // Always remove existing layer-specific handlers before adding new ones to prevent stacking
      if (map.getLayer(resultsLayerId)) {
        map.off('click', resultsLayerId);
        map.off('mouseenter', resultsLayerId);
        map.off('mouseleave', resultsLayerId);
        
        // Add click handler for popups
        map.on('click', resultsLayerId, (e) => {
          // Prevent map panning/default behavior
          e.preventDefault();
          e.originalEvent.stopPropagation();
          
          const feature = e.features[0];
          const props = feature.properties;
          
          // Close existing popup
          if (popup) {
            popup.remove();
          }
          
          // Create popup content
          const popupContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.4;">
              <div style="font-weight: bold; color: ${props.deviceColor}; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                ${props.deviceName}
              </div>
              <div style="margin-bottom: 4px;"><strong>Time:</strong> ${props.fixTime}</div>
              <div style="margin-bottom: 4px;"><strong>Location:</strong> ${props.latitude}, ${props.longitude}</div>
              ${props.speed !== 'N/A' ? `<div style="margin-bottom: 4px;"><strong>Speed:</strong> ${props.speed}</div>` : ''}
              ${props.altitude !== 'N/A' ? `<div style="margin-bottom: 4px;"><strong>Altitude:</strong> ${props.altitude}</div>` : ''}
              ${props.accuracy !== 'N/A' ? `<div style="margin-bottom: 4px;"><strong>Accuracy:</strong> ${props.accuracy}</div>` : ''}
              ${props.address !== 'Address not available' ? `<div style="margin-bottom: 4px; font-size: 12px; color: #666;"><strong>Address:</strong> ${props.address}</div>` : ''}
            </div>
          `;
          
          // Create new popup
          const newPopup = new maplibregl.Popup({
            offset: [0, -10],
            closeButton: true,
            closeOnClick: false,
          })
            .setLngLat(feature.geometry.coordinates)
            .setHTML(popupContent)
            .addTo(map);
            
          setPopup(newPopup);
        });
        
        // Remove any existing general click handler first to prevent stacking
        if (map._radiusSearchClickHandler) {
          map.off('click', map._radiusSearchClickHandler);
          delete map._radiusSearchClickHandler;
        }
        
        // Add general map click handler to close popups when clicking elsewhere
        const handleMapClick = (e) => {
          // Check if click was on a marker
          const clickedOnMarker = map.queryRenderedFeatures(e.point, { layers: [resultsLayerId] }).length > 0;
          
          // If clicked on marker, let the marker click handler deal with it
          if (clickedOnMarker) {
            return;
          }
          
          // Check if click was inside a popup element
          const popupElements = document.querySelectorAll('.maplibregl-popup');
          let clickedInsidePopup = false;
          
          for (const popupEl of popupElements) {
            if (popupEl.contains(e.originalEvent.target)) {
              clickedInsidePopup = true;
              break;
            }
          }
          
          // If not clicked on marker or inside popup, close the popup
          if (!clickedInsidePopup && popup) {
            popup.remove();
            setPopup(null);
          }
        };
        
        map.on('click', handleMapClick);
        
        // Store the handler for cleanup
        map._radiusSearchClickHandler = handleMapClick;
        
        // Change cursor on hover
        map.on('mouseenter', resultsLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', resultsLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // Smart pan-to-center: Only pan if we're not already close to the search location
      const currentCenter = map.getCenter();
      const currentLat = currentCenter.lat;
      const currentLng = currentCenter.lng;
      const searchLat = searchInfo.latitude;
      const searchLng = searchInfo.longitude;
      
      // Calculate distance in degrees (rough approximation)
      const latDiff = Math.abs(currentLat - searchLat);
      const lngDiff = Math.abs(currentLng - searchLng);
      const maxDiff = Math.max(latDiff, lngDiff);
      
      // If we're more than ~1km away (rough degree approximation), pan to center
      const threshold = 0.01; // Approximately 1km
      if (maxDiff > threshold) {
        map.easeTo({
          center: [searchLng, searchLat],
          duration: 1000
        });
      }
    }

    return () => {
      // Remove event listeners
      if (map.getLayer(resultsLayerId)) {
        map.off('click', resultsLayerId);
        map.off('mouseenter', resultsLayerId);
        map.off('mouseleave', resultsLayerId);
        map.removeLayer(resultsLayerId);
      }
      
      // Remove general click handler
      if (map._radiusSearchClickHandler) {
        map.off('click', map._radiusSearchClickHandler);
        delete map._radiusSearchClickHandler;
      }
      
      if (map.getLayer(`${radiusLayerId}-outline`)) {
        map.removeLayer(`${radiusLayerId}-outline`);
      }
      if (map.getLayer(radiusLayerId)) {
        map.removeLayer(radiusLayerId);
      }
      if (map.getLayer(centerLayerId)) {
        map.removeLayer(centerLayerId);
      }
      if (map.getSource(resultsSourceId)) {
        map.removeSource(resultsSourceId);
      }
      if (map.getSource(radiusSourceId)) {
        map.removeSource(radiusSourceId);
      }
      if (map.getSource(centerSourceId)) {
        map.removeSource(centerSourceId);
      }
    };
  }, [results, searchInfo, devices, theme]); // Removed 'popup' from dependencies to prevent redrawing

  return null;
};

export default MapRadiusSearchResults;