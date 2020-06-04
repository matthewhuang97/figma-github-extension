// With help from:
// https://github.com/material-foundation/github-squash-and-merge-pr-descriptions/blob/develop/main.js

let currentURL;

function collapseNewlines(text) {
  const result = [];
  let prevWasNewline = false;
  debugger;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (!prevWasNewline) {
        result.push(line);
      }
      prevWasNewline = true;
    } else {
      result.push(line);
      prevWasNewline = false;
    }
  }
  return result.join('\n');
}

function process(text) {
  text = text.trim() + `\n\nSee the original pull request here: ${currentURL}`;
  text = collapseNewlines(text);
  return text;
}

// These look like <img width="889" src=...>
function removeImgTags(line) {
  if (!line) {
    return line;
  }

  const tagStartInd = line.indexOf('<img');
  if (tagStartInd === -1) {
    return line;
  }

  const tagEndInd = line.indexOf('>', tagStartInd);
  if (tagEndInd === -1) {
    return line;
  }

  line = (
    line.slice(0, tagStartInd).trim() +
    ' ' +
    line.slice(tagEndInd + 1).trim()
  ).trim();

  return removeImgTags(line);
}

// These look like ![title](url)
// Literally anything can exist inside "title" except for [ and ]. We might not
// even want to bother checking for these ATM. When removing links, replace the
// link with the placeholder specified in []
function removeGifsOrLinks(line, gifsOrLinks) {
  const startToken = gifsOrLinks === 'GIFS' ? '![' : '[';
  if (!line) {
    return line;
  }

  const startInd = line.indexOf(startToken);
  if (startInd === -1) {
    return line;
  }
  // Make sure that the [ doesn't come after a ! if we're just filtering links
  if (gifsOrLinks === 'LINKS') {
    if (startInd !== 0 && line[startInd - 1] === '!') {
      // If we reached here, our line looks like "... ![ ...". Continue
      // searching from after the "![".
      return (
        line.slice(0, startInd + 1) +
        removeGifsOrLinks(line.slice(startInd + 1), gifsOrLinks)
      );
    }
  }

  const middleInd = line.indexOf('](', startInd);
  if (middleInd === -1) {
    return line;
  }

  const placeholder = line.slice(startInd + 1, middleInd);

  const endInd = line.indexOf(')', middleInd);
  if (endInd === -1) {
    return line;
  }

  let result = line.slice(0, startInd).trim() + ' ';
  if (gifsOrLinks === 'LINKS') {
    result += placeholder + ' ';
  }
  result += line.slice(endInd + 1).trim();

  return removeGifsOrLinks(result.trim(), gifsOrLinks);
}

// There's definitely false positives in these cleaning functions (we might
// strip real content), but they're probably pretty contrived examples. The
// biggest thing is probably that we don't special-case code-formatting via ``
// and block-code formatting via ``` ```. It's probably somewhat common that
// people put <img> tags in their code.
function filterRichContent(text, imagesGifs = false, links = false) {
  console.log('filtering');

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (imagesGifs) {
      lines[i] = removeImgTags(lines[i]);
      lines[i] = removeGifsOrLinks(lines[i], 'GIFS');
    }
    if (links) {
      lines[i] = removeGifsOrLinks(lines[i], 'LINKS');
    }
  }

  return collapseNewlines(lines.join('\n'));
}

function getMergeMessageField() {
  return document.getElementById('merge_message_field');
}

function injectActions() {
  const commitForm = document.querySelector('div.commit-form');
  const commitFormActions = document.querySelector('div.commit-form-actions');
  if (!commitForm || !commitFormActions) {
    return;
  }
  const flippyContainerFound = document.querySelector('div.flippyContainer');
  if (flippyContainerFound) {
    return;
  }

  const container = document.createElement('div');
  container.className = 'flippyContainer';

  function makeButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn flippyButton';
    return button;
  }

  const imagesButton = makeButton();
  imagesButton.appendChild(document.createTextNode('Remove Images/GIFs'));

  const linksButton = makeButton();
  linksButton.appendChild(document.createTextNode('Detach Links/Attachments'));

  const flippyLink = document.createElement('a');
  // TODO: add appropriate link
  flippyLink.href = 'https://google.com';
  flippyLink.target = '_blank';
  const flippy = document.createElement('img');
  flippyLink.appendChild(flippy);
  flippy.src = chrome.runtime.getURL('./figtree.png');
  flippy.width = 34;

  imagesButton.addEventListener('click', () => {
    const field = getMergeMessageField();
    field.value = filterRichContent(field.value, true, false);
  });
  linksButton.addEventListener('click', () => {
    const field = getMergeMessageField();
    field.value = filterRichContent(field.value, false, true);
  });

  container.appendChild(imagesButton);
  container.appendChild(linksButton);
  container.appendChild(flippyLink);

  commitForm.insertBefore(container, commitFormActions);
}

function updateMergeMessage() {
  const mergeMessageField = getMergeMessageField();
  const prText = document.getElementsByClassName('comment-form-textarea')[0]
    .value;
  mergeMessageField.value = process(prText);
}

// On PR pages, finds a "Squash and Merge" button and adds a click event
// listener that replaces the commit description with the PR description.
function scanForSquashAndMergeButtons() {
  currentURL = 'https://' + document.location.host + document.location.pathname;
  if (document.location.href.indexOf('/pull/') === -1) {
    return;
  }

  const squashButton = document.querySelector(
    'button.btn-group-squash[data-details-container=".js-merge-pr"]'
  );
  if (!squashButton || squashButton.getAttribute('flippyRegistered')) {
    return;
  }

  console.log('registering');
  squashButton.addEventListener('click', function () {
    // GitHub populates the commit message with a bit of a delay, so we also
    // need to delay our population of the message.
    setTimeout(() => {
      injectActions();
      updateMergeMessage();
    }, 50);
  });
  squashButton.setAttribute('flippyRegistered', true);
}

// If currently in the "confirm merge" flow
function scanForCommitForm() {
  const commitForm = document.querySelector('div.commit-form');
  if (!commitForm) {
    return;
  }
  injectActions();
}

setInterval(scanForSquashAndMergeButtons, 800);
setInterval(scanForCommitForm, 800);
