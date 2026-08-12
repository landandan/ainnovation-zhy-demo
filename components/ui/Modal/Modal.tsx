import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

const Modal = ({
                   open,
                   title,
                   children,
                   onCancel,
                   onOk,
                   footer,
                   maskClosable = true,
                   keyboard = true,
                   width = 520,
               }) => {

    useEffect(() => {
        if (!keyboard || !open) return;

        const handler = (e) => {
            if (e.key === "Escape") {
                onCancel?.();
            }
        };

        window.addEventListener("keydown", handler);

        return () => {
            window.removeEventListener("keydown", handler);
        };
    }, [keyboard, open]);

    if (!open) return null;

    const modal = (
        <div
            className="modal-mask"
            onClick={() => {
                if (maskClosable) {
                    onCancel?.();
                }
            }}
        >
            <div
                className="modal-wrapper"
                onClick={(e) => e.stopPropagation()}
                style={{ width }}
            >
                <div className="modal-header">
                    <span>{title}</span>

                    <button
                        className="modal-close"
                        onClick={onCancel}
                    >
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    {children}
                </div>

                {footer !== null && (
                    <div className="modal-footer">
                        {footer ?? (
                            <>
                                <button onClick={onCancel}>
                                    Cancel
                                </button>

                                <button
                                    className="primary"
                                    onClick={onOk}
                                >
                                    OK
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};

export default Modal;