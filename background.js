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

async function getMetadataAndExceptions(tabs) {
  const metadata = [];
  const exceptionTabIds = [];
  for (const tab of tabs) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScript.js']
      });
      if (results && results[0] && results[0].result) {
        metadata.push(results[0].result);
      } else {
        metadata.push(`${tab.title} - ${tab.url}`);
      }
    } catch (error) {
      console.warn(`Failed to execute script on tab ${tab.id}:`, error);
      metadata.push(`${tab.title} - ${tab.url}`);
      exceptionTabIds.push(tab.id);
    }
  }
  return { metadata, exceptionTabIds };
}

async function groupTabsByClusters(clustersText, exceptionTabIds) {
  // Get the current active window
  const currentWindow = await chrome.windows.getCurrent();

  console.log('Starting cluster parsing for text:', clustersText.substring(0, 200) + '...');

  // 1. Parse clusters - accept both "Cluster" and "Group" formats
  const clusterRegex = /\*\*((?:Cluster|Group) \d+: .+?)\*\*([\s\S]+?)(?=\*\*(?:Cluster|Group)|$)/g;
  let match;
  const clusters = [];
  while ((match = clusterRegex.exec(clustersText)) !== null) {
    const clusterName = match[1].trim();
    const urls = [];
    // Match both (url) and [text](url) formats
    const urlRegex = /\((https?:\/\/[^\s)]+)\)|\[(?:[^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(match[2])) !== null) {
      const url = urlMatch[1] || urlMatch[2];
      if (url) urls.push(url);
    }
    clusters.push({ name: clusterName, urls });
  }

  console.log('Found clusters:', clusters.length);
  console.log('Parsed clusters:', clusters);

  if (clusters.length === 0) {
    console.warn('No clusters found! LLM output may not be in expected format.');
    return;
  }

  // 2. Get all open tabs in the current window
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
  const allTabUrls = tabs.map(tab => tab.url);
  console.log('All open tab URLs in current window:', allTabUrls);

  // Normalization function
  const normalize = url => url ? url.replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '') : '';

  // Track all grouped tab IDs
  let allGroupedTabIds = [];

  // 3. For each cluster, group tabs
  for (const cluster of clusters) {
    console.log('Cluster:', cluster.name);
    console.log('Cluster URLs:', cluster.urls);
    const normalizedClusterUrls = cluster.urls.map(normalize);
    console.log('Normalized Cluster URLs:', normalizedClusterUrls);
    const tabIds = tabs
      .filter(tab => {
        if (!tab.url || exceptionTabIds.includes(tab.id)) {
          return false;
        }
        return normalizedClusterUrls.includes(normalize(tab.url));
      })
      .map(tab => tab.id);
    allGroupedTabIds = allGroupedTabIds.concat(tabIds);
    console.log('Matching tab IDs:', tabIds);
    if (tabIds.length > 0) {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title: cluster.name });
      console.log(`Created group '${cluster.name}' with groupId:`, groupId);
    } else {
      console.log(`No matching tabs found for cluster '${cluster.name}'.`);
    }
  }

  // Move exception tabs to the right of the rightmost grouped tab
  if (exceptionTabIds.length > 0 && allGroupedTabIds.length > 0) {
    // Find the rightmost index among grouped tabs
    const groupedTabs = tabs.filter(tab => allGroupedTabIds.includes(tab.id));
    const maxIndex = Math.max(...groupedTabs.map(tab => tab.index));
    // Move each exception tab to the right of the rightmost grouped tab
    for (let i = 0; i < exceptionTabIds.length; i++) {
      await chrome.tabs.move(exceptionTabIds[i], { index: maxIndex + 1 + i });
      console.log(`Moved exception tab ${exceptionTabIds[i]} to index ${maxIndex + 1 + i}`);
    }
  }
}

async function clusterTabs() {
  try {
    // Get all open tabs in the current window
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Collect metadata and exception tab IDs
    const { metadata, exceptionTabIds } = await getMetadataAndExceptions(tabs);

    console.log('Collected metadata:', metadata);

    // Prompt LM Studio to cluster the data
    const response = await client.post({
      model: 'meta-llama-3.1-8b-instruct',
      prompt: `Cluster the following web pages into groups based on their content:\n${metadata.join('\n')}`,
    });

    console.log('LM Studio response:', response);

    // Extract the LLM's text response (OpenAI format)
    let llmText = '';
    if (response.choices && response.choices[0]) {
      llmText = response.choices[0].message?.content || response.choices[0].text || '';
    } else if (response.data && typeof response.data === 'string') {
      llmText = response.data;
    } else if (typeof response === 'string') {
      llmText = response;
    } else {
      llmText = JSON.stringify(response);
    }

    console.log('Extracted LLM text:', llmText);
    console.log('LLM text length:', llmText.length);

    if (!llmText || llmText.length === 0) {
      console.error('No LLM text extracted!');
      return [];
    }

    // Group tabs in Chrome by clusters, passing exceptionTabIds
    await groupTabsByClusters(llmText, exceptionTabIds);

    // Logging for debugging
    console.log('Processed and grouped clusters.');

    return [];
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
  