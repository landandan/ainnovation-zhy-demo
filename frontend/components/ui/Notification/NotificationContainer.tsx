import { useEffect } from "react";
import NotificationItem from "./NotificationItem";

export default function NotificationContainer({
                                                  list,
                                                  remove,
                                              }) {

    useEffect(() => {

        const timers = list.map(item => {

            if (item.duration === 0) return null;

            return setTimeout(() => {
                remove(item.key);
            }, item.duration);

        });

        return () => {
            timers.forEach(clearTimeout);
        };

    }, [list]);

    return (
        <div className="notification-container">

            {list.map((item: any) => {
                const { key, ...rest } = item;
                return (
                    <NotificationItem
                        key={key}
                        {...rest}
                        onClose={() => remove(key)}
                    />
                );
            })}

        </div>
    );
}