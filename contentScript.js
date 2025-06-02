function getMetadata() {
    const title = document.title;
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const mainHeaders = Array.from(document.querySelectorAll('h1, h2, h3')).map(header => header.textContent).join(', ');
    const content = document.body.innerText.substring(0, 1000);
    return `${title} | ${description} | ${mainHeaders} | ${content} | ${window.location.href}`;
}

// Return the metadata directly for chrome.scripting.executeScript
getMetadata();
  