import { refreshHard } from "../index.js";

/**
 * DOM mutation observer for detecting new elements added to the page
 */
let domObserver: MutationObserver | null = null;

/**
 * Check if any nodes in the provided list contain data-mos attributes
 * Recursively checks children as well
 */
function containsMosNode(nodes: NodeList | HTMLElement[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const currentNode = nodes[i] as HTMLElement;

    // Skip non-element nodes (text nodes, comments, etc.)
    if (currentNode.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    // Check if current node has data-mos attribute
    if (currentNode.dataset && currentNode.dataset.mos) {
      return true;
    }

    // Recursively check children
    if (currentNode.children && currentNode.children.length > 0) {
      const childrenArray = Array.from(currentNode.children) as HTMLElement[];
      if (containsMosNode(childrenArray)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Handle mutation observer changes - only trigger refresh if data-mos elements are affected
 */
function handleMutationObserverChanges(mutations: MutationRecord[]): void {
  if (!mutations || mutations.length === 0) {
    return;
  }

  let shouldRefresh = false;

  for (const mutation of mutations) {
    const addedNodes = Array.from(mutation.addedNodes) as HTMLElement[];
    const removedNodes = Array.from(mutation.removedNodes) as HTMLElement[];
    const allNodes = [...addedNodes, ...removedNodes];

    // Check if any added or removed nodes contain data-mos elements
    if (containsMosNode(allNodes)) {
      shouldRefresh = true;
      break;
    }
  }

  // Only trigger expensive refresh when data-mos elements are actually affected
  if (shouldRefresh) {
    refreshHard();
  }
}

/**
 * Start DOM mutation observer to watch for data-mos elements being added/removed
 * Uses AOS-like targeted observation to avoid unnecessary refreshes
 */
export function startDomObserver(): void {
  // Clean up existing observer
  domObserver?.disconnect();

  // Create new observer with targeted mutation handling
  domObserver = new MutationObserver(handleMutationObserverChanges);

  // Observe document.documentElement (like AOS) for better performance than document.body
  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

export default {
  startDomObserver,
};
