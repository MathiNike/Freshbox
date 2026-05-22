-- Función para administrar el stock dinámicamente según la máquina de estados
CREATE OR REPLACE FUNCTION gestionar_stock_pedido()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    stock_estaba_descontado BOOLEAN;
    stock_debe_descontarse BOOLEAN;
BEGIN
    -- Evaluamos si el stock ya estaba descontado en el estado anterior
    stock_estaba_descontado := OLD.estado IN ('listo para despacho', 'asignado', 'en ruta', 'entregado');
    
    -- Evaluamos si el stock debe estar descontado en el nuevo estado
    stock_debe_descontarse := NEW.estado IN ('listo para despacho', 'asignado', 'en ruta', 'entregado');

    -- ESCENARIO 1: SALIDA DE INVENTARIO (Descuento)
    -- Estaba en un estado sin descuento (ej. pendiente) y pasa a un estado con descuento (ej. listo para despacho)
    IF stock_debe_descontarse = TRUE AND stock_estaba_descontado = FALSE THEN
        FOR item IN SELECT id_producto, cantidad FROM pedido_producto WHERE id_pedido = NEW.id LOOP
            UPDATE producto
            SET stock = GREATEST(0, stock - item.cantidad) -- GREATEST evita números negativos por seguridad
            WHERE id = item.id_producto;
        END LOOP;
    
    -- ESCENARIO 2: RETORNO AL INVENTARIO (Devolución)
    -- Estaba descontado (ej. en ruta) y pasa a un estado sin descuento (ej. incidencia o cancelado)
    ELSIF stock_debe_descontarse = FALSE AND stock_estaba_descontado = TRUE THEN
        FOR item IN SELECT id_producto, cantidad FROM pedido_producto WHERE id_pedido = NEW.id LOOP
            UPDATE producto
            SET stock = stock + item.cantidad
            WHERE id = item.id_producto;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminamos el trigger anterior (de la versión 1) para evitar que ambos choquen
DROP TRIGGER IF EXISTS trigger_descontar_stock ON pedido;
-- Por precaución, si ejecutamos este archivo múltiples veces
DROP TRIGGER IF EXISTS trigger_gestionar_stock ON pedido;

-- Creamos el nuevo trigger maestro en la tabla pedido
CREATE TRIGGER trigger_gestionar_stock
AFTER UPDATE OF estado ON pedido
FOR EACH ROW
EXECUTE FUNCTION gestionar_stock_pedido();
