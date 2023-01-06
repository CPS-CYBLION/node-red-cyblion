module.exports = function (RED) {
    function cyblionMqttOutHandler(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.topic = config.topic;
        node.clientNodeId = config.client;

        node.client = RED.nodes.getNode(node.clientNodeId);

        if (node.client) {
            node.on("input", function (msg) {
                node.client.publish(node.topic, msg.payload);
            });
        }
    }

    RED.nodes.registerType("cyblion mqtt out", cyblionMqttOutHandler);
};
