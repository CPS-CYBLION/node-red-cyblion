const NETPIE_MQTT_HOST = 'mqtt://mqtt.netpie.io';
const NETPIE_MQTTS_HOST = 'mqtts://mqtt.netpie.io';

const NETPIE_CYBLION_MQTT_HOST = 'mqtt://fhe.netpie.io';
const NETPIE_CYBLION_MQTTS_HOST = 'mqtts://fhe.netpie.io';

const mqtt = require('mqtt')
const EventEmitter = require('events');

module.exports = class {
	constructor(option) {
		let that = this;

		this.deviceid = option.deviceid;
		this.devicetoken = option.devicetoken;
		this.option = option;

		if (this.option.secure) {
			this.netpie_broker_uri = NETPIE_MQTTS_HOST;
			this.cyblion_broker_uri = NETPIE_CYBLION_MQTTS_HOST;
		}
		else {
			this.netpie_broker_uri = NETPIE_MQTT_HOST;
			this.cyblion_broker_uri = NETPIE_CYBLION_MQTT_HOST;
		}

		this.emitter = new EventEmitter();

		this.on = function(...args) {
			that.emitter.on(...args);
		}

		this.once = function(...args) {
			that.emitter.once(...args);
		}

		this.removeListener = function(...args) {
			that.emitter.removeListener(...args);
		}
	}

	_connect_netpie() {
		let that = this;
		if (!this.netpie_client || !this.netpie_client.connected) {
			this.netpie_client  = mqtt.connect(that.netpie_broker_uri, {
			    keepalive: 30,
			    clientId: that.deviceid,
			    username: that.devicetoken,
			    password: '',
			    clean: true,
			    reconnectPeriod: 1000,
			    connectTimeout: 30 * 1000,
			    rejectUnauthorized: false
			});

			this.netpie_client.on('connect', ()=> {
				if (this.option.subscribe_shadow_updated) {
					this.netpie_client.subscribe('@shadow/data/updated');
				}
				this._connect_cyblion();
			});

			this.netpie_client.on('close', ()=> {
				this._disconnect_cyblion();
			});

			this.netpie_client.on('disconnect', ()=> {
				this._disconnect_cyblion();
			});

			this.netpie_client.on('message', (topic, payload)=> {
				if (topic.startsWith('@msg/')) {
					try {
						payload = payload.toString();
					}
					catch(e) {
						payload = null;
					}
					that.emitter.emit('msg', topic, payload);
				}
				else if (topic.startsWith('@shadow/data/updated')) {
					let shadowobj;
					try {
						shadowobj = JSON.parse(payload.toString());
					}
					catch(e) {
						shadowobj = {}
					}
					that.emitter.emit('shadow_updated', shadowobj);
				}
			});
		}
	}

	_disconnect_netpie() {
		if (this.netpie_client && this.netpie_client.connected) {
			this.netpie_client.end();
		}
	}

	_connect_cyblion() {
		let that = this;
		if (!this.cyblion_client || !this.cyblion_client.connected) {
			this.cyblion_client  = mqtt.connect(that.cyblion_broker_uri, {
			    keepalive: 30,
			    clientId: that.deviceid,
			    username: that.devicetoken,
			    password: '',
			    clean: true,
			    reconnectPeriod: 1000,
			    connectTimeout: 30 * 1000,
			    rejectUnauthorized: false
			});

			this.cyblion_client.on('connect', ()=> {
				that.emitter.emit('connected');
				that.cyblion_client.subscribe('@cstore/data/updated/#');
			});

			this.cyblion_client.on('message', (topic, payload)=> {
				if (topic.startsWith('@cmsg')) {
					try {
						payload = payload.toString();
					}
					catch(e) {
						payload = null;
					}
					that.emitter.emit('cmsg', topic, payload);
				}
				else if (topic.startsWith('@cstore')) {
					let key = topic.split('/').slice(3).join('/');
					let value;
					try {
						value = payload.toString();
					}
					catch(e) {
						value = null;
					}
					that.emitter.emit('cstore_updated', key, value);
				}
			});
		}
	}

	_disconnect_cyblion() {
		if (this.cyblion_client && this.cyblion_client.connected) {
			this.cyblion_client.end();
		}
	}

	connect() {
		let that = this;
		this._connect_netpie();
	}	

	disconnect() {
		this.netpie_client.disconnect();
		this.cyblion_client.disconnect();
	}

	publish(topic, payload) {
		let out;
		if (topic.startsWith('@msg/') || topic.startsWith('@shadow/')) {
			if (typeof(payload) == 'object') {
				out = JSON.stringify(payload);
			}
			else {
				out = String(payload);
			}
			this.netpie_client.publish(topic, out);
		}
		else if (topic.startsWith('@cmsg/') || topic.startsWith('@cstore/')) {
			if (typeof(payload) == 'object') {
				out = JSON.stringify(payload);
			}
			else {
				out = String(payload);
			}
			this.cyblion_client.publish(topic, out);
		}
	}

	subscribe(topic) {
		if (topic.startsWith('@msg/') || topic.startsWith('@shadow/')) {
			this.netpie_client.subscribe(topic);
		}
		else if (topic.startsWith('@cmsg/') || topic.startsWith('@cstore/')) {
			this.cyblion_client.subscribe(topic);
		}
	}

	writeShadow(arg1, arg2) {
		if (typeof(arg1) == 'string') {
			let val;
			if (typeof(arg2) == 'object') {
				val = JSON.stringify(arg2);
			}
			else {
				val = String(arg2);
			}
			let dobj = {data: {}};
			dobj.data[arg1] = arg2;
			let out = JSON.stringify(dobj);
			this.netpie_client.publish('@shadow/data/update',out);
		}
		else if (typeof(arg1) == 'object') {
			let out = JSON.stringify({data: arg1});
			this.netpie_client.publish('@shadow/data/update',out);
		}
	}

	writeCStore(key, value) {
		this.cyblion_client.publish(`@cstore/data/update/${key}`, value);
	}

	publishMsg(topic, payload) {
		this.netpie_client.publish(`@msg/${topic}`, payload);
	}

	publishPrivateMsg(topic, payload) {
		this.netpie_client.publish(`@private/${topic}`, payload);
	}
}
