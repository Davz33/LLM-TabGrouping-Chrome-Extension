// Set up LM Studio connection (simplified)
const client = {
    async post({ model, prompt }) {
      const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    }
};

export { client };

async function getMetadata(tabs) {
    const metadata = [];
    for (const tab of tabs) {
      try {
        // Use Manifest V3 scripting API instead of executeScript
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
        });
        if (results && results[0] && results[0].result) {
          metadata.push(results[0].result);
        } else {
          // Include basic tab info if script returns nothing
          metadata.push(`${tab.title} - ${tab.url}`);
        }
      } catch (error) {
        console.warn(`Failed to execute script on tab ${tab.id}:`, error);
        // Include basic tab info even if script execution fails
        metadata.push(`${tab.title} - ${tab.url}`);
      }
    }
    return metadata;
}

async function clusterTabs() {
  try {
    // Get all open tabs
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // Collect metadata from each tab
    const metadata = await getMetadata(tabs);

    console.log('Collected metadata:', metadata);

    // Prompt LM Studio to cluster the data
    const response = await client.post({
      model: 'meta-llama-3.1-8b-instruct',
      prompt: `Cluster the following web pages into groups based on their content:\n${metadata.join('\n')}`,
    });

    console.log('LM Studio response:', response);

    // Process the clustering results - ensure clusters is always an array
    let clusters = [];
    
    if (response && typeof response === 'object') {
      if (response.data && Array.isArray(response.data)) {
        clusters = response.data;
      } else if (Array.isArray(response)) {
        clusters = response;
      } else if (response.clusters && Array.isArray(response.clusters)) {
        clusters = response.clusters;
      } else if (response.choices && Array.isArray(response.choices)) {
        // Handle OpenAI-style response format
        clusters = response.choices.map((choice, index) => ({
          id: index + 1,
          data: choice.message?.content || choice.text || choice
        }));
      } else {
        // Create a simple cluster from any response
        clusters = [{ 
          id: 1, 
          data: response.content || response.text || response.message || JSON.stringify(response)
        }];
      }
    } else {
      // Handle string or other primitive responses
      clusters = [{ 
        id: 1, 
        data: typeof response === 'string' ? response : 'No valid clustering response received'
      }];
    }

    // Ensure clusters is always an array
    if (!Array.isArray(clusters)) {
      clusters = [{ id: 1, data: 'Invalid response format' }];
      
    }

    console.log('Processing clusters:', clusters);

    // Process the results
    for (const cluster of clusters) {
      console.log(`Cluster ${cluster.id || 'Unknown'}:`);
      console.log(cluster.data || cluster);
    }
    
    return clusters;
  } catch (error) {
    console.error('Error clustering tabs:', error);
    // Return a default error cluster
    return [{ id: 1, data: `Error: ${error.message}` }];
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clusterTabs') {
    clusterTabs()
      .then((result) => {
        sendResponse({ success: true, clusters: result });
      })
      .catch((error) => {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});
  