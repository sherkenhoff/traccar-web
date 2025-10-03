import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  IconButton, OutlinedInput, InputAdornment, Popover, FormControl, InputLabel, Select, MenuItem, TextField, Button, Box, Typography
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useTranslation } from '../common/components/LocalizationProvider';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  searchPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: 300,
  },
  coordinateRow: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  },
}));

const RadiusSearch = ({ onResultsFound }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const searchRef = useRef();
  const [searchAnchorEl, setSearchAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Search parameters
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('1000'); // Default 1km
  const [deviceId, setDeviceId] = useState(selectedDeviceId || '');
  const [locationName, setLocationName] = useState('');

  // Geocoding function (using OpenStreetMap Nominatim)
  const geocodeLocation = async (locationName) => {
    if (!locationName.trim()) return null;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`
      );
      const data = await response.json();
      if (data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  };

  // Get current location from browser
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  // Perform radius search
  const performSearch = async (searchParams) => {
    setLoading(true);
    try {
      let searchLat = searchParams ? searchParams.latitude : parseFloat(latitude);
      let searchLon = searchParams ? searchParams.longitude : parseFloat(longitude);
      const searchRadius = searchParams ? searchParams.radius : parseFloat(radius);

      // If no coordinates but location name provided, geocode first
      if ((!searchLat || !searchLon) && locationName) {
        const coords = await geocodeLocation(locationName);
        if (coords) {
          searchLat = coords.latitude;
          searchLon = coords.longitude;
          setLatitude(searchLat.toString());
          setLongitude(searchLon.toString());
        }
      }

      if (!searchLat || !searchLon || !searchRadius) {
        throw new Error('Please provide valid coordinates and radius');
      }

      const params = new URLSearchParams({
        latitude: searchLat.toString(),
        longitude: searchLon.toString(),
        radius: searchRadius.toString(),
      });

      if (deviceId) {
        params.append('deviceId', deviceId.toString());
      }

      const response = await fetchOrThrow(`/api/positions/radius?${params}`);
      const positions = await response.json();
      
      onResultsFound(positions, { latitude: searchLat, longitude: searchLon, radius: searchRadius });
      setSearchAnchorEl(null);
    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performSearch();
  };

  const clearSearch = () => {
    setLatitude('');
    setLongitude('');
    setLocationName('');
    setRadius('1000');
    onResultsFound([], null);
  };

  const handleSearchPanelOpen = () => {
    setLatitude('');
    setLongitude('');
    setSearchAnchorEl(searchRef.current);
  };

  return (
    <>
      <IconButton 
        ref={searchRef}
        onClick={handleSearchPanelOpen}
        title={t('Radius Search')}
        onDragStart={(e) => e.dataTransfer.setData('application/traccar-radius-search', 'true')}
      >
        <SearchIcon />
      </IconButton>
      
      <Popover
        open={!!searchAnchorEl}
        anchorEl={searchAnchorEl}
        onClose={() => setSearchAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <div className={classes.searchPanel}>
          <Typography variant="h6">Radius Search</Typography>
          
          <TextField
            label="Location Name"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Detroit Zoo, Central Park"
            size="small"
            fullWidth
          />
          
          <Typography variant="body2" color="textSecondary" align="center">
            - OR -
          </Typography>
          
          <div className={classes.coordinateRow}>
            <TextField
              label="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
            <TextField
              label="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              type="number"
              size="small"
              fullWidth
            />
            <IconButton 
              onClick={getCurrentLocation}
              title="Use Current Location"
              size="small"
            >
              <MyLocationIcon />
            </IconButton>
          </div>

          <TextField
            label="Radius (meters)"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            type="number"
            size="small"
            fullWidth
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Device (Optional)</InputLabel>
            <Select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              label="Device (Optional)"
            >
              <MenuItem value="">All Devices</MenuItem>
              {Object.values(devices).map((device) => (
                <MenuItem key={device.id} value={device.id}>
                  {device.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <div className={classes.actionButtons}>
            <Button onClick={clearSearch} disabled={loading}>
              Clear
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
};

export default RadiusSearch;