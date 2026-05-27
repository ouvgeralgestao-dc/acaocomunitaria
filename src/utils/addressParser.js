/**
 * ASA v3 - Brazilian Address Parser
 * Converte strings de endereço brasileiras em objetos estruturados.
 * Exemplo: "Rua Cananéia, 135, Jardim Gramacho" -> { street: "Rua Cananéia", number: "135", neighborhood: "Jardim Gramacho" }
 */
const addressParser = {
    parse(input) {
        if (!input) return null;

        // Regex para: Logradouro, Numero, Bairro
        const fullRegex = /^(.*?),\s*(\d+)\s*,\s*(.*?)(?:\s*-\s*.*)?$/i;
        // Regex para: Logradouro, Numero
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

        // Se não bater no padrão estruturado, retorna como busca simples
        return {
            street: input.trim(),
            number: null,
            neighborhood: null,
            isStructured: false
        };
    }
};

module.exports = addressParser;
