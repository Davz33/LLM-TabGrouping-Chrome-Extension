document.addEventListener('DOMContentLoaded', function() {
    const clusterButton = document.getElementById('clusterButton');
    
    clusterButton.addEventListener('click', async function() {
        try {
            // Disable button while processing
            clusterButton.disabled = true;
            clusterButton.textContent = 'Clustering...';
            
            // Send message to background script to trigger clustering
            await chrome.runtime.sendMessage({ action: 'clusterTabs' });
            
            // Show completion message
            clusterButton.textContent = 'Complete!';
            
            // Close popup after a short delay
            setTimeout(() => {
                window.close();
            }, 1000);
            
        } catch (error) {
            console.error('Error triggering clustering:', error);
            clusterButton.textContent = 'Error - Try Again';
            clusterButton.disabled = false;
        }
    });
});
  