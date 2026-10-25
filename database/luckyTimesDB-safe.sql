-- Se omite DROP DATABASE para proteger datos existentes.

/*tiquete a partir del 10000*/

CREATE DATABASE IF NOT EXISTS luckyTimesDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
use luckyTimesDB;

CREATE TABLE IF NOT EXISTS usuario(
    id_usuario int primary key not null auto_increment,
    nombre_usuario varchar(100) not null,
    contrasena varchar(150) not null,
    /**/
    comision_parley int,
    comision_tripleta int,
    monto_limite_parley int,
    /**/
    
    rol varchar(13), /*Puesto o Administrador*/
    estado varchar(10),
    tiempo_sistema int,
    permite_eliminar varchar(5),
    limite_credito int /*Maneja efectivo si es Puesto*/
);

CREATE TABLE IF NOT EXISTS sorteo(
    id_sorteo int primary key not null auto_increment,
    nombre_sorteo varchar(100) not null,
    hora_cierre time not null,
    hora_sorteo time not null,
    cantidad_ganadores int,
    se_paga_3 varchar(2),
    sorteo_reventado varchar(2),
    estado varchar(10) /*Activo - Inactivo*/
);

CREATE TABLE IF NOT EXISTS parametizacion_sorteo(
    id_parametizacion_sorteo int primary key not null auto_increment,
    id_usuario int, foreign key (id_usuario) references usuario(id_usuario),
    id_sorteo int, foreign key (id_sorteo) references sorteo(id_sorteo),
    comision double,
    paga_calle int,
    paga_reventado int,
    porcentaje_restriccion double, /*esta era la devolucion*/
    monto_arranque int,
    limite_venta int,
    aplica_devolucion varchar(2),
    paga_a_los_3 varchar(2),
    pago_primero int,
    pago_segundo int,
    pago_tercero int,
    incluir_generar varchar(2),
    mostrar_venta varchar(2)
);

CREATE TABLE IF NOT EXISTS programacion(
    id_programacion int primary key not null auto_increment,
    id_sorteo int, foreign key (id_sorteo) references sorteo(id_sorteo),
    id_usuario int, foreign key (id_usuario) references usuario(id_usuario),
    fecha_cierre datetime,
    fecha_sorteo datetime,

    numeros_restringidos varchar(200),
    estado varchar(10) /*Activo - Inactivo - Cerrado*/
);

CREATE TABLE IF NOT EXISTS tiquete(
    id_tiquete int primary key not null auto_increment,
    id_programacion int, foreign key (id_programacion) references programacion(id_programacion),
    nombre_comprador varchar(150),
    total int,
    fecha_tiquete datetime,
    revertido varchar(20),
    fecha_reversion datetime
);

CREATE TABLE IF NOT EXISTS detalle_tiquete(
    id_detalle_tiquete int primary key not null auto_increment,
    id_tiquete int, foreign key (id_tiquete) references tiquete(id_tiquete),
    monto int not null,
    reventado int,
    numero varchar(300)
);

CREATE TABLE IF NOT EXISTS numero_ganador(
    id_numero_ganador int primary key not null auto_increment,
    id_programacion int, foreign key (id_programacion) references programacion (id_programacion),
    numero_ganador int,
    bolita_reventada varchar(10)
    /*Blanca o Reventada*/
);

/*En construccion*/
CREATE TABLE IF NOT EXISTS reporte_cobro(
    id_reporte_cobro int primary key not null auto_increment,
    id_usuario int, foreign key (id_usuario) references usuario(id_usuario),
    evento varchar(50),
    fecha_evento datetime,
    tipo varchar(20), /* Cierre Sorteo, Retiro, Abono */
    importe int,
    comision int,
    premio int,
    balance int,
    descripcion varchar(20),
    fecha_transaccion datetime,
    generado varchar(2) /* Si o No */
);

-- No se importa el usuario con contraseña insegura del ejemplo original.
