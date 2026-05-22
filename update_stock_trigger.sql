-- Función para descontar el stock cuando un pedido pasa a 'entregado'
CREATE OR REPLACE FUNCTION descontar_stock_al_entregar()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- Verificamos si el estado cambió a 'entregado' y antes no lo era
    IF NEW.estado = 'entregado' AND OLD.estado IS DISTINCT FROM 'entregado' THEN
        -- Iteramos sobre los productos del pedido para descontar las cantidades exactas
        FOR item IN SELECT id_producto, cantidad FROM pedido_producto WHERE id_pedido = NEW.id LOOP
            -- Actualizamos el stock del producto
            UPDATE producto
            SET stock = stock - item.cantidad
            WHERE id = item.id_producto AND stock >= item.cantidad;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminamos el trigger si ya existe para evitar duplicados
DROP TRIGGER IF EXISTS trigger_descontar_stock ON pedido;

-- Creamos el trigger en la tabla pedido
CREATE TRIGGER trigger_descontar_stock
AFTER UPDATE OF estado ON pedido
FOR EACH ROW
EXECUTE FUNCTION descontar_stock_al_entregar();
