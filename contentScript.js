function getMetadata() {
    const title = document.title;
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const mainHeaders = Array.from(document.querySelectorAll('h1, h2, h3')).map(header => header.textContent);
    const content = document.body.innerText.substring(0, 1000); // Limit content length
  
    return {
      title,
      description,
      mainHeaders: mainHeaders.slice(0, 5), // Limit headers
      content,
      url: window.location.href
    };
}

// Return the metadata directly for chrome.scripting.executeScript
getMetadata();
  