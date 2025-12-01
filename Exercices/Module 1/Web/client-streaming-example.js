/**
 * Exemple client JavaScript pour tester le streaming du serveur agent
 * 
 * Ce script montre comment :
 * - Envoyer une requête POST avec des données JSON
 * - Lire le stream de réponse chunk par chunk
 * - Parser les événements Server-Sent Events (SSE)
 * 
 * Usage: node client-streaming-example.js
 */

const SERVER_URL = 'http://localhost:3001/chat';

/**
 * Fonction pour envoyer une requête et lire le streaming
 */
async function testAgentStream() {
  const requestData = {
    threadId: 'test-thread-123',
    message: 'fait moi un poeme sur un chat'
  };

  console.log('📤 Envoi de la requête...');
  console.log('URL:', SERVER_URL);
  console.log('Données:', JSON.stringify(requestData, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('✅ Connexion établie, lecture du stream...\n');

    // Lire le stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('\n\n✅ Stream terminé');
        break;
      }

      // Décoder le chunk reçu
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      console.log(chunk);

      // Parser les lignes pour extraire le contenu
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.content) {
              fullMessage += parsedData.content;
            }
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        }
      }
    }

    // Afficher le message complet à la fin
    if (fullMessage) {
      console.log('\n' + '='.repeat(50));
      console.log('📝 MESSAGE COMPLET:');
      console.log('='.repeat(50));
      console.log(fullMessage);
      console.log('='.repeat(50));
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Le serveur ne semble pas démarré. Lancez-le d\'abord avec:');
      console.log('   tsx Exercices/Module\\ 1/Web/agent-memory-server-streaming.mts');
    }
  }
}

// ============================================================================
// EXÉCUTION
// ============================================================================

console.log('\n🤖 Client de test pour Agent Streaming\n');
testAgentStream().catch(console.error);
