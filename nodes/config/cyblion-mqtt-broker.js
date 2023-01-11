module.exports = function (RED) {
    const Cyblion = require("../../lib/cyblion-mqtt/index");

    function hasProperty(obj, propName) {
        //JavaScript does not protect the property name hasOwnProperty
        //Object.prototype.hasOwnProperty.call is the recommended/safer test
        return Object.prototype.hasOwnProperty.call(obj, propName);
    }

    function updateStatus(node) {
        let setStatus = setStatusDisconnected;
        if (node.connecting) {
            setStatus = setStatusConnecting;
        } else if (node.connected) {
            setStatus = setStatusConnected;
        }
        setStatus(node, true);
    }

    function setStatusDisconnected(node, allNodes) {
        if (allNodes) {
            for (var id in node.users) {
                if (hasProperty(node.users, id)) {
                    node.users[id].status({
                        fill: "red",
                        shape: "ring",
                        text: "node-red:common.status.disconnected",
                    });
                }
            }
        } else {
            node.status({
                fill: "red",
                shape: "ring",
                text: "node-red:common.status.disconnected",
            });
        }
    }

    function setStatusConnecting(node, allNodes) {
        if (allNodes) {
            for (var id in node.users) {
                if (hasProperty(node.users, id)) {
                    node.users[id].status({
                        fill: "yellow",
                        shape: "ring",
                        text: "node-red:common.status.connecting",
                    });
                }
            }
        } else {
            node.status({
                fill: "yellow",
                shape: "ring",
                text: "node-red:common.status.connecting",
            });
        }
    }

    function setStatusConnected(node, allNodes) {
        if (allNodes) {
            for (var id in node.users) {
                if (hasProperty(node.users, id)) {
                    node.users[id].status({
                        fill: "green",
                        shape: "dot",
                        text: "node-red:common.status.connected",
                    });
                }
            }
        } else {
            node.status({
                fill: "green",
                shape: "dot",
                text: "node-red:common.status.connected",
            });
        }
    }

    function mqttBrokerHandle(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.deviceId = config.deviceId;
        node.deviceToken = config.deviceToken;
        node.connected = false;
        node.users = {};

        node.register = function (mqttNode) {
            node.users[mqttNode.id] = mqttNode;
            if (Object.keys(node.users).length === 1) {
                node.connect();
                //update nodes status
                setTimeout(function () {
                    updateStatus(node, true);
                }, 1);
            }
        };

        node.deregister = function (mqttNode, done, autoDisconnect) {
            delete node.users[mqttNode.id];
            if (
                autoDisconnect &&
                node.connected &&
                Object.keys(node.users).length == 0
            ) {
                node.disconnect(done);
            } else {
                done();
            }
        };

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
                    setStatusConnected(node, true);
                });

                node.client.connect();
            }
        };

        node.disconnect = function (callback) {
            if (node.connected && node.client) {
                node.client.once("disconnected", () => {
                    callback();
                    setStatusDisconnected(node, true);
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
    }

    RED.nodes.registerType("cyblion-mqtt-broker", mqttBrokerHandle);
};
