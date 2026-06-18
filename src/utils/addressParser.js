/**
 * SIMAC - Brazilian Address Parser
 */
const addressParser = {
    parse(input) {
        if (!input) return null;

        const fullRegex = /^(.*?),\s*(\d+)\s*,\s*(.*?)(?:\s*-\s*.*)?$/i;
        const streetNumberRegex = /^(.*?),\s*(\d+)\s*$/i;

        let match = input.match(fullRegex);
        if (match) {
            return {
                street: match[1].trim(),
                number: match[2].trim(),
                neighborhood: match[3].trim(),
                isStructured: true
            };
        }

        match = input.match(streetNumberRegex);
        if (match) {
            return {
                street: match[1].trim(),
                number: match[2].trim(),
                neighborhood: null,
                isStructured: true
            };
        }

        return {
            street: input.trim(),
            number: null,
            neighborhood: null,
            isStructured: false
        };
    }
};

module.exports = addressParser;
