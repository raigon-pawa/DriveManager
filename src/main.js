const API_URL = 'http://localhost:8080';

let files = [];
let currentAccount = null;

async function addGoogleAccount() {
  try {
    window.open(`${API_URL}/`, "_self");

    await renderAccountsDropdown();
    if (!currentAccount) {
      currentAccount = accounts;
      await fetchFiles();
    }
    
  } catch (error) {
    console.error('Error adding Google account:', error);
  }
}

async function getAllAccounts() {
  const accounts = await fetch(`${API_URL}/accounts`)
        .then(data => {
          return data.json()
        })

  return accounts;
};


async function handleAccountChange(accountEmail) {
  if (accountEmail === "All Accounts") {
    // If the "Select Account" option is selected, show all accounts' files
    currentAccount = null;
    await fetchFiles(true); // Pass a flag to indicate fetching for all accounts
  } else {
    // If a specific account is selected, fetch files for that account only
    const accounts = await getAllAccounts();
    currentAccount = accounts.find(a => a.email === accountEmail);
    if (currentAccount) {
      await fetchFiles(false);
    }
  }
}

async function removeCurrentAccount() {
  if (currentAccount) {
    let email = currentAccount.email;
    await fetch(`${API_URL}/accounts/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    currentAccount = null;
    files = [];
    await renderAccountsDropdown();
    renderFiles();
  }
}

async function driveFiles() {
  const files = await fetch(`${API_URL}/drive-files`)
        .then(data => {
          return data.json();
        });
  return files;
}

async function fetchFiles(fetchAll = true) {
  if (fetchAll) {
    // Fetch files for all accounts
    files = [];
    const drives = await driveFiles();

    for (const drive of drives) {
        files.push(...drive.drive.map(file => ({ ...file, accountEmail: drive.email })));
    }
  } else if (currentAccount) {
    // Fetch files for the current account only
    try {
      const drives = await driveFiles();

      const file = drives.find(drive => drive.email === currentAccount.email)

      files = file.drive.map(file => ({ ...file, accountEmail: currentAccount.email }));
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  }

  renderFiles();
}


function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function renderAccountsDropdown() {
  const accounts = await getAllAccounts();
  const accountsSelect = document.getElementById('accountsSelect');
  
  accountsSelect.innerHTML = `
    <option value="">All Accounts</option>
    ${accounts.map(account => `
      <option value="${account.id}" ${currentAccount?.id === account.id ? 'selected' : ''}>
        ${account.email}
      </option>
    `).join('')}
  `;
}

function buildFileTree(files) {
  const tree = {};
  const rootItems = [];

  files.forEach(file => {
    file.children = [];
    tree[file.id] = file;
  });

  files.forEach(file => {
    if (!file.parents || file.parents.length === 0) {
      rootItems.push(file);
    } else {
      const parent = tree[file.parents[0]];
      if (parent) {
        parent.children.push(file);
      } else {
        rootItems.push(file);
      }
    }
  });

  return rootItems;
}


let openFolders = new Set();

function renderFileItem(file, level = 0) {
  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
  const icon = isFolder ? 'fa-folder' : 'fa-file';
  const padding = level * 20;

  // Check if the current folder is open
  const isOpen = openFolders.has(file.id);

  return `
    <div class="file-item" style="padding-left: ${padding}px" data-file-id="${file.id}">
      <div class="file-name">
      ${isFolder ? `<span class="folder-toggle">${isOpen ? '▼' : '▶'}</span>` : ''}
        <i class="fas ${icon}"></i>
        ${file.name}
      </div>
      <div class="file-size">${formatFileSize(file.size)}</div>
    </div>
    ${isOpen ? file.children.map(child => renderFileItem(child, level + 1)).join('') : ''}
  `;
}
      
      function initializeFolderToggle() {
        // Get all folder toggle elements after the DOM is rendered
        const folderToggleElements = document.querySelectorAll('.folder-toggle');
      
        // Add event listeners to toggle folders
        folderToggleElements.forEach(toggleElement => {
          toggleElement.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            const folderId = fileItem?.getAttribute('data-file-id');
            
            if (folderId) {
              toggleFolderVisibility(folderId);
            }
          });
        });
      }

      function toggleFolderVisibility(folderId) {
        if (openFolders.has(folderId)) {
          openFolders.delete(folderId); // Close the folder
        } else {
          openFolders.add(folderId); // Open the folder
        }
        
        // Re-render the files list to reflect the folder's new state
        renderFiles();
      }

      function renderFiles() {
        const filesList = document.getElementById('filesList');
        const searchInput = document.getElementById('searchFiles').value.toLowerCase();
        
        let filteredFiles = files;
        if (searchInput) {
          filteredFiles = files.filter(file => 
            file.name.toLowerCase().includes(searchInput)
          );
        }
      
      const fileTree = buildFileTree(filteredFiles);
      filesList.innerHTML = fileTree.map(file => renderFileItem(file)).join('');

        // Initialize folder toggle functionality after rendering the files
        initializeFolderToggle();
    }
    
    function initializeSearchListener() {
      document.getElementById('searchFiles').addEventListener('input', renderFiles);
    } 
    
    async function init() {
      
      document.getElementById('addAccount').addEventListener('click', addGoogleAccount);
      document.getElementById('removeAccount').addEventListener('click', removeCurrentAccount);
      document.getElementById('accountsSelect').addEventListener('change', (e) => {
        const selectedText = e.target.options[e.target.selectedIndex].textContent.trim();
        handleAccountChange(selectedText); // Pass the text content of the selected option
    });

      await renderAccountsDropdown();
      initializeSearchListener();

      const accounts = await getAllAccounts(); 
      if (accounts.length > 0) {
        currentAccount = accounts[0];
        await fetchFiles();
      } 
  }

init();