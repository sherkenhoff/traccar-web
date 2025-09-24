import { useId, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { map } from '../core/MapView';
import { formatTime, getStatusColor } from '../../common/util/formatter';
import { mapIconKey } from '../core/preloadImages';
import { useSelector } from 'react-redux';
import maplibregl from 'maplibre-gl';

const MapRadiusSearchResults = ({ results, searchInfo }) => {
  const id = useId();
  const theme = useTheme();

  const devices = useSelector((state) => state.devices.items);

  const resultsSourceId = `${id}-results`;
  const radiusSourceId = `${id}-radius`;
  const resultsLayerId = `${id}-results-layer`;
  const radiusLayerId = `${id}-radius-layer`;

  useEffect(() => {
    if (!results || !searchInfo) {
      // Clean up any existing layers
      if (map.getLayer(resultsLayerId)) {
        map.removeLayer(resultsLayerId);
      }
      if (map.getLayer(radiusLayerId)) {
        map.removeLayer(radiusLayerId);
      }
      if (map.getSource(resultsSourceId)) {
        map.removeSource(resultsSourceId);
      }
      if (map.getSource(radiusSourceId)) {
        map.removeSource(radiusSourceId);
      }
      return;
    }

    // Create circle for search radius
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

    // Create features for search results
    const resultFeatures = results.map((position) => {
      const device = devices[position.deviceId];
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
          category: mapIconKey(device?.category),
          color: position.attributes?.color || getStatusColor(device?.status) || 'red',
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
          'circle-opacity': 0.1,
          'circle-stroke-color': theme.palette.primary.main,
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.8,
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
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
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
      // Cleanup on component unmount
      if (map.getLayer(resultsLayerId)) {
        map.removeLayer(resultsLayerId);
      }
      if (map.getLayer(radiusLayerId)) {
        map.removeLayer(radiusLayerId);
      }
      if (map.getSource(resultsSourceId)) {
        map.removeSource(resultsSourceId);
      }
      if (map.getSource(radiusSourceId)) {
        map.removeSource(radiusSourceId);
      }
    };
  }, [results, searchInfo, devices, theme]);

  return null;
};

export default MapRadiusSearchResults;