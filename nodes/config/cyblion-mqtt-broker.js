module.exports = function (RED) {
    const Cyblion = require("../../lib/cyblion-mqtt/index");
    function mqttBrokerHandle(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.deviceId = config.deviceId;
        node.deviceToken = config.deviceToken;
        node.connected = false;

        node.connect = function () {
            if (!node.connected) {
                if (node.client) {
                    node.client.disconnect();
                }
                node.client = new Cyblion({
                    deviceid: node.deviceId,
                    devicetoken: node.deviceToken,
                    subscribe_shadow_updated: false,
                    secure: false,
                });

                node.client.on("connected", () => {
                    node.connected = true;
                    console.log("mqtt connected");
                });

                node.client.connect();
            }
        };

        node.disconnect = function (callback) {
            if (node.connected && node.client) {
                node.client.once("disconnected", () => {
                    callback();
                });
                node.client.disconnect();
            }
        };

        node.writeCStore = function (topic, payload) {
            if (node.connected && node.client) {
                node.client.writeCStore(topic, String(payload));
            }
        };

        node.publish = function (topic, payload) {
            if (node.connected && node.client) {
                node.client.publish(topic, payload);
            }
        };

        node.subscribe = function (topic, callback) {
            console.log("subscribe is running");
            console.log(node.connected == true);
            if (node.connected && node.client) {
                console.log("node is node connected");
                node.client.subscribe(topic);

                node.client.on("msg", (incomeTopic, payload) => {
                    if (topic == incomeTopic) {
                        callback(payload);
                    }
                });

                node.client.on("cmsg", (incomeTopic, payload) => {
                    if (topic == incomeTopic) {
                        callback(payload);
                    }
                });
            }
        };

        node.on("close", (done) => {
            console.log("close is running");
            node.disconnect(() => {
                done();
            });
        });

        if (!node.connected && !node.client) {
            node.connect();
        }
    }

    RED.nodes.registerType("cyblion-mqtt-broker", mqttBrokerHandle);
};
