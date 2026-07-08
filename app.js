require("dotenv").config();

const express = require("express");
const askBYMS = require("./ai");
const { envoyerMessage } = require("./whatsapp");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Logique de réponse partagée entre /chat et le webhook WhatsApp
async function genererReponse(message) {

    const texte = message.toLowerCase();

    if (texte.includes("bonjour")) {

        return `👋 Bonjour et bienvenue chez Kiosque Al Kass !

Je suis BYMS, votre assistant. En ce moment, toutes nos montres sont en promo 🔥 — jusqu'à 5 000 FCFA de réduction selon le modèle.

Comment puis-je vous aider ?

1️⃣ Voir le catalogue
2️⃣ Connaître les prix
3️⃣ Commander
4️⃣ Livraison`;

    } else if (texte.includes("livraison")) {

        return `🇨🇮 Côte d'Ivoire :
✅ Paiement à la livraison — 0 risque pour vous !

🌍 Afrique de l'Ouest :
Expédition + livraison : 7 000 FCFA.
Paiement avant expédition.

Dites-moi votre ville, je vous confirme les délais 🚀`;

    } else if (texte.includes("commander")) {

        return `Parfait, on finalise ça tout de suite ⌚🔥

Envoyez-moi juste ces infos :

Nom :
Téléphone :
Pays :
Ville :
Adresse :
Modèle :
Quantité :

Dès réception, votre commande est validée !`;

    } else {

        try {
            return await askBYMS(message);
        } catch (err) {
            console.error("Erreur OpenAI :", err.message);
            return "Merci pour votre message. Envoyez la photo de la montre ou consultez notre catalogue WhatsApp afin que je puisse mieux vous aider.";
        }

    }
}

app.get("/", (req, res) => {
    res.send("🤖 BYMS est en ligne !");
});

// Endpoint de test manuel (Postman, etc.)
app.post("/chat", async (req, res) => {

    const message = req.body.message;

    if (!message) {
        return res.status(400).json({ erreur: "Le champ 'message' est requis." });
    }

    const reponse = await genererReponse(message);

    res.json({
        assistant: "BYMS",
        response: reponse
    });

});

// --- Webhook WhatsApp ---

// 1. Vérification du webhook (Meta appelle ceci une seule fois, à la configuration)
app.get("/webhook", (req, res) => {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook vérifié.");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// 2. Réception des messages entrants
app.post("/webhook", async (req, res) => {

    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) {
            return res.sendStatus(200);
        }

        const expediteur = message.from; // numéro WhatsApp du client
        const texte = message.text?.body;

        if (texte) {
            const reponse = await genererReponse(texte);
            await envoyerMessage(expediteur, reponse);
        }

        res.sendStatus(200);

    } catch (err) {
        console.error("Erreur webhook :", err.message);
        res.sendStatus(200); // toujours répondre 200 pour éviter que Meta désactive le webhook
    }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("BYMS lancé sur le port " + PORT);
});
