import {config} from '../config';
import {v3 as hueAPI} from 'node-hue-api';
import {logger} from '../logger';

const hue = config.notifications.philips_hue;
const apiKey = hue.apiKey;
const bridgeIp = hue.bridgeIp;
const lightIds = hue.lightIds;
const lightColor = hue.lightColor;
const lightPattern = hue.lightPattern;
const LightState = hueAPI.lightStates.LightState;
const clientId = hue.clientId;
const clientSecret = hue.clientSecret;
const accessToken = hue.accessToken;
const refreshToken = hue.refreshToken;
const remoteApiUsername = hue.remoteApiUsername;

// Default Light State
const lightState = new LightState()
	.on(true)
	.brightness(100)
	.rgb(46.27, 72.55, 0);

const adjustLightsWithAPI = (hueBridge: import('node-hue-api/lib/api/Api')) => {
	logger.debug('Connected to Hue bridge.');
	// Set the custom light state (COLOR and METHOD here)
	if (lightColor) {
		const rgbArray = lightColor.split(',');
		// If there's not three values, must not be RGB
		if (rgbArray.length === 3) {
			lightState.rgb(rgbArray[0], rgbArray[1], rgbArray[2]);
		} else {
			logger.debug('✖ Error assigning RGB Values');
		}
	}

	// If blink is specified, then blink the lights
	if (lightPattern === 'blink') {
		lightState.alertLong();
	}

	// If we've been given light IDs, then only adjust those IDs
	if (lightIds) {
		const arrayOfIDs = lightIds.split(',');
		arrayOfIDs.forEach(light => {
			logger.debug('adjusting all hue lights');
			(hueBridge.lights.setLightState(light, lightState) as Promise<any>).catch((error: Error) => {
				logger.error('Failed to adjust all lights.');
				logger.error(error);
				throw error;
			});
		});
	} else { // Adjust all light IDs
		hueBridge.lights.getAll().then((allLights: any[]) => {
			allLights.forEach((light: any) => {
				logger.debug('adjusting specified lights');
				(hueBridge.lights.setLightState(light, lightState) as Promise<any>).catch((error: Error) => {
					logger.error('Failed to adjust specified lights.');
					logger.error(error);
					throw error;
				});
			});
		}).catch((error: Error) => {
			logger.error('Failed to get all lights.');
			logger.error(error);
			throw error;
		});
	}
};

export function adjustPhilipsHueLights() {
	// Check if the required variables have been set
	if (hue.apiKey && hue.bridgeIp) {
		logger.info('↗ adjusting Hue lights over LAN');
		(async () => {
			logger.debug('Attempting to connect to Hue bridge at ' + bridgeIp);
			hueAPI.api.createLocal(bridgeIp).connect(apiKey).then(
				hueBridge => {
					adjustLightsWithAPI(hueBridge);
					logger.info('✔ adjusted Hue lights over LAN');
				},
				(error: Error) => {
					logger.error('✖ couldn\'t adjust hue lights.', error);
				});
		})();
	} else if (hue.apiKey && hue.clientId && hue.clientSecret) {
		logger.info('↗ adjusting Hue lights over cloud');
		(async () => {
			logger.debug('Attempting to connect to Hue bridge over cloud');
			const remoteBootstrap = hueAPI.api.createRemote(clientId, clientSecret);
			if (hue.accessToken && hue.refreshToken) {
				remoteBootstrap.connectWithTokens(accessToken, refreshToken, remoteApiUsername)
					.then(hueBridge => {
						adjustLightsWithAPI(hueBridge);
						logger.info('✔ adjusted Hue lights over cloud');
					},
					(error: Error) => {
						logger.error('Failed to get a remote Hue connection using supplied tokens.');
						logger.error(error);
						throw error;
					});
			}
		})();
	} else {
		logger.error('✖ couldn\'t adjust hue lights');
	}
}
