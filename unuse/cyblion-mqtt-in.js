module.exports = function (RED) {
    function cyblionMqttInHandler(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.topic = config.topic;
        node.clientNodeId = config.client;

        node.client = RED.nodes.getNode(node.clientNodeId);

        if (node.client) {
            console.log("Please run for me please");
            node.client.subscribe(node.topic, (payload) => {
                console.log("callback is call");
                node.send(payload);
            });
        }
    }

    RED.nodes.registerType("cyblion mqtt in", cyblionMqttInHandler);
};
