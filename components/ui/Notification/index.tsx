import { createRoot, Root } from "react-dom/client"
import { v4 as uuidv4 } from 'uuid'
import NotificationContainer from "./NotificationContainer";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

let list = [];

function ensureContainer() {
    if (typeof window === "undefined") return;

    if (!container) {
        container = document.createElement("div");
        document.body.appendChild(container);

        root = createRoot(container);
    }
}

function render() {
    if (!root) return;

    root.render(
        <NotificationContainer
            list={list}
            remove={remove}
        />
    );
}

function remove(key: string) {
    list = list.filter(item => item.key !== key);
    render();
}

const notification = {
    open(config) {
        ensureContainer();

        list.push({
            key: uuidv4(),
            duration: 3000,
            ...config,
        });

        render();
    },
};

export default notification
