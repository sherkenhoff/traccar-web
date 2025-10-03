import { useCallback, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapSelectedDevice from '../map/main/MapSelectedDevice';
import MapAccuracy from '../map/main/MapAccuracy';
import MapGeofence from '../map/MapGeofence';
import MapCurrentLocation from '../map/MapCurrentLocation';
import PoiMap from '../map/main/PoiMap';
import MapPadding from '../map/MapPadding';
import { devicesActions } from '../store';
import MapDefaultCamera from '../map/main/MapDefaultCamera';
import MapLiveRoutes from '../map/main/MapLiveRoutes';
import MapPositions from '../map/MapPositions';
import MapOverlay from '../map/overlay/MapOverlay';
import MapGeocoder from '../map/geocoder/MapGeocoder';
import MapScale from '../map/MapScale';
import MapNotification from '../map/notification/MapNotification';
import MapRadiusSearchResults from '../map/main/MapRadiusSearchResults';
import useFeatures from '../common/util/useFeatures';
import { map } from '../map/core/MapView';
import fetchOrThrow from '../common/util/fetchOrThrow';

const MainMap = ({ filteredPositions, selectedPosition, onEventsClick, radiusSearchResults, radiusSearchInfo, onRadiusSearch }) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const eventsAvailable = useSelector((state) => !!state.events.items.length);

  const features = useFeatures();

  const onMarkerClick = useCallback((_, deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
  }, [dispatch]);

  const handleRadiusSearch = (longitude, latitude) => {
    const performSearch = async () => {
      try {
        const query = new URLSearchParams({
          deviceId: 0, // Search all devices
          from: '1970-01-01T00:00:00Z',
          to: new Date().toISOString(),
          longitude,
          latitude,
          radius: 1000, // Default 1km
        });

        const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`);
        const results = await response.json();
        onRadiusSearch(results, { longitude, latitude, radius: 1000 });
      } catch (error) {
        console.error('Radius search failed:', error);
      }
    };
    performSearch();
  };

  const onMapReady = useCallback(() => {
    const mapContainer = map.getContainer();

    const handleDragOver = (e) => {
      if (e.dataTransfer.types.includes('application/traccar-radius-search')) {
        e.preventDefault();
      }
    };

    const handleDrop = (e) => {
      if (e.dataTransfer.types.includes('application/traccar-radius-search')) {
        e.preventDefault();
        const rect = mapContainer.getBoundingClientRect();
        const point = [e.clientX - rect.left, e.clientY - rect.top];
        const { lng, lat } = map.unproject(point);
        handleRadiusSearch(lng, lat);
      }
    };

    mapContainer.addEventListener('dragover', handleDragOver);
    mapContainer.addEventListener('drop', handleDrop);

    return () => {
      mapContainer.removeEventListener('dragover', handleDragOver);
      mapContainer.removeEventListener('drop', handleDrop);
    };
  }, [handleRadiusSearch]);

  return (
    <>
      <MapView onMapReady={onMapReady}>
        <MapOverlay />
        <MapGeofence />
        <MapAccuracy positions={filteredPositions} />
        <MapLiveRoutes />
        <MapPositions
          positions={filteredPositions}
          onMarkerClick={onMarkerClick}
          selectedPosition={selectedPosition}
          showStatus
        />
        <MapDefaultCamera />
        <MapSelectedDevice />
        <PoiMap />
        <MapRadiusSearchResults results={radiusSearchResults} searchInfo={radiusSearchInfo} onSearch={onRadiusSearch} />
      </MapView>
      <MapScale />
      <MapCurrentLocation />
      <MapGeocoder />
      {!features.disableEvents && (
        <MapNotification enabled={eventsAvailable} onClick={onEventsClick} />
      )}
      {desktop && (
        <MapPadding start={parseInt(theme.dimensions.drawerWidthDesktop, 10) + parseInt(theme.spacing(1.5), 10)} />
      )}
    </>
  );
};

export default MainMap;
