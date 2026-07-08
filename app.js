require("dotenv").config();

const express = require("express");
const askBYMS = require("./ai").askBYMS;
const manageOrder = require("./ai").manageOrder;
const { envoyerMessage, envoyerImage } = require("./whatsapp");

const app = express();
app.use(express.json());
app.use("/photos", express.static("photos"));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const BASE_URL = process.env.BASE_URL || "https://byms-whatsapp-bot.onrender.com";

// Marques reconnues et leur photo associée (fichier dans le dossier /photos)
const photosMarques = [
    { motsCles: ["gshock", "g-shock", "g shock"], fichier: "casio-gshock.jpg", nom: "Casio G-SHOCK" },
    { motsCles: ["edifice"], fichier: "casio-edifice.jpg", nom: "Casio Edifice" },
    { motsCles: ["curren homme", "curren pour homme"], fichier: "curren-homme.jpg", nom: "Curren Modèle Homme" },
    { motsCles: ["curren femme", "curren pour femme"], fichier: "curren-femme.jpg", nom: "Curren Modèle Femme" },
    { motsCles: ["curren luxueux", "curren luxe", "curren chrono"], fichier: "curren-luxueux.jpg", nom: "Curren Luxueux" },
    { motsCles: ["curren"], fichier: "curren-homme.jpg", nom: "Curren" }, // par défaut si juste "curren"
    { motsCles: ["mont blanc", "montblanc"], fichier: "montblanc.jpg", nom: "Mont Blanc" },
    { motsCles: ["cartier"], fichier: "cartier.jpg", nom: "Cartier" },
    { motsCles: ["hublot"], fichier: "hublot.jpg", nom: "Hublot" },
    { motsCles: ["poedagar"], fichier: "poedagar.jpg", nom: "POEDAGAR" },
    { motsCles: ["swatch"], fichier: "swatch.jpg", nom: "Swatch" },
    { motsCles: ["daniel wellington", "dw"], fichier: "daniel-wellington.jpg", nom: "Daniel Wellington" },
    { motsCles: ["full arabica", "arabica"], fichier: "full-arabica.jpg", nom: "Full Arabica" }
];

function detecterMarque(texte) {
    for (const marque of photosMarques) {
        if (marque.motsCles.some(mot => texte.includes(mot))) {
            return marque;
        }
    }
    return null;
}

const NUMERO_PROPRIETAIRE = process.env.NUMERO_PROPRIETAIRE; // ex: 2250160114397

async function notifierProprietaire(order, clientId) {

    if (!NUMERO_PROPRIETAIRE) return;

    const recap = `🆕 Nouvelle commande BYMS !

👤 Nom : ${order.nom}
📞 Téléphone : ${order.telephone}
🌍 Pays : ${order.pays}
🏙️ Ville : ${order.ville}
📍 Adresse : ${order.adresse}
⌚ Modèle : ${order.modele}
🔢 Quantité : ${order.quantite}

Client WhatsApp : ${clientId}`;

    await envoyerMessage(NUMERO_PROPRIETAIRE, recap);

}

// Sessions de commande en cours, par numéro/identifiant client
// ⚠️ Stockage en mémoire : se réinitialise si le serveur redémarre
const sessionsCommande = {};

// Logique de réponse partagée entre /chat et le webhook WhatsApp
async function genererReponse(message, clientId) {

    const texte = message.toLowerCase();

    // Si une commande est déjà en cours pour ce client, on continue de la remplir
    if (sessionsCommande[clientId]) {

        const resultat = await manageOrder(message, sessionsCommande[clientId]);

        if (resultat.complete) {
            delete sessionsCommande[clientId]; // commande finalisée, on nettoie la session
            await notifierProprietaire(resultat.order, clientId);
        } else {
            sessionsCommande[clientId] = resultat.order;
        }

        return resultat.reply;

    }

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

        sessionsCommande[clientId] = {
            nom: "", telephone: "", pays: "", ville: "", adresse: "", modele: "", quantite: ""
        };

        const resultat = await manageOrder(message, sessionsCommande[clientId]);

        if (resultat.complete) {
            delete sessionsCommande[clientId];
            await notifierProprietaire(resultat.order, clientId);
        } else {
            sessionsCommande[clientId] = resultat.order;
        }

        return resultat.reply;

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
    const clientId = req.body.from || "web-test";

    if (!message) {
        return res.status(400).json({ erreur: "Le champ 'message' est requis." });
    }

    const reponse = await genererReponse(message, clientId);

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

            const marqueDetectee = !sessionsCommande[expediteur] ? detecterMarque(texte.toLowerCase()) : null;

            if (marqueDetectee) {
                const urlImage = `${BASE_URL}/photos/${marqueDetectee.fichier}`;
                await envoyerImage(expediteur, urlImage, `⌚ ${marqueDetectee.nom}`);
            }

            const reponse = await genererReponse(texte, expediteur);
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
