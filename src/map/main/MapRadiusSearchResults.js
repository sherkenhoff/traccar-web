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

  useEffect(() => {
    if (popup) {
      popup.remove();
      setPopup(null);
    }

    if (!results || !searchInfo) {
      // Clean up any existing layers
      if (map.getLayer(resultsLayerId)) {
        map.removeLayer(resultsLayerId);
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

    const radiusFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [searchInfo.longitude, searchInfo.latitude],
      },
      properties: {
        radius: searchInfo.radius,
      },
    };

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
        type: 'circle',
        source: radiusSourceId,
        paint: {
          'circle-radius': {
            stops: [
              [0, 0],
              [20, ['interpolate', ['linear'], ['zoom'], 0, 0, 20, ['*', ['get', 'radius'], 0.001]]],
            ],
          },
          'circle-color': theme.palette.primary.main,
          'circle-opacity': 0.08, // Very light fill
          'circle-stroke-color': theme.palette.primary.main,
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.6,
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
            'circle-radius': 4,
            'circle-color': ['get', 'deviceColor'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
            'circle-opacity': 0.8,
          },
        });
        
        // Add click handler for popups
        map.on('click', resultsLayerId, (e) => {
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
        
        // Change cursor on hover
        map.on('mouseenter', resultsLayerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', resultsLayerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // Fit map to show all results and search radius
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([searchInfo.longitude, searchInfo.latitude]);
      resultFeatures.forEach((feature) => {
        bounds.extend(feature.geometry.coordinates);
      });

      // Add padding around the radius
      const radiusInDegrees = searchInfo.radius / 111000; // Approximate conversion
      bounds.extend([searchInfo.longitude + radiusInDegrees, searchInfo.latitude + radiusInDegrees]);
      bounds.extend([searchInfo.longitude - radiusInDegrees, searchInfo.latitude - radiusInDegrees]);

      map.fitBounds(bounds, { padding: 50 });
    }

    return () => {
      // Clean up popup
      if (popup) {
        popup.remove();
        setPopup(null);
      }
      
      // Remove event listeners
      if (map.getLayer(resultsLayerId)) {
        map.off('click', resultsLayerId);
        map.off('mouseenter', resultsLayerId);
        map.off('mouseleave', resultsLayerId);
        map.removeLayer(resultsLayerId);
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
  }, [results, searchInfo, devices, theme, popup]);

  return null;
};

export default MapRadiusSearchResults;