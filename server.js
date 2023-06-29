// Importar los módulos necesarios
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongodb = require('mongodb');
const puppeteer = require('puppeteer');
const { TwitterApi } = require('twitter-api-v2');

// Configurar la aplicación Express
const app = express();
const server = http.createServer(app);
const io = socketio(server);
// Conexión con twitter
const twitter_javi = new TwitterApi({
	appKey: '4jueH6rRz1qB1fMc1CQ0D0WYb',
	appSecret: 'MTwQ2DxpaSYsuLi9cCiFOVd7CVBhIINVzZ3HuvcxVwpIsNidRA',
	accessToken: '1635827136417128448-Nhm4nUGOkpn3XmnGPADvP2qlkOIv12',
	accessSecret: 'FN4n7jyKKQk6atY6jEicTExzTyDUN5DTaurhUFmZJ7coP',
});

// Configurar la conexión a la base de datos MongoDB
const MongoClient = mongodb.MongoClient;
const mongoURL = 'mongodb://localhost:27017/sistema_domotica_dsd';
let db;

MongoClient.connect(mongoURL, { useUnifiedTopology: true }, (err, dbo) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }

  console.log('Conexión exitosa a la base de datos');
  db = dbo.db();
});

//Función para subir un tweet
async function subirTweet() {
  try {
    var tweet = 'Hola se ha realizado un cambio en el programa de la práctica 4 de DSD en la fecha:' + new Date();
    await twitter_javi.v2.tweet(tweet);
    console.log('Tweet subido exitosamente');
  } catch (error) {
    console.error('Error subiendo tweet:', error);
  }
}

//Función para obtener el tiempo de weather.com
async function getWeather(){
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://weather.com/es-ES/tiempo/hoy/l/4d145bdbed286d510465a75ddcafc9e7870535a3055f853d517048a3e0923c41');

  await page.setViewport({width: 1920, height: 1080});

  await page.waitForSelector('.card.Card--card--2AzRg');

  const lumiweather = await page.evaluate(() => {
  	const lumiel = document.querySelector("#todayDetails > section > div.TodayDetailsCard--detailsContainer--2yLtL > div:nth-child(7) > div.WeatherDetailsListItem--wxData--kK35q > span");
  	return lumiel ? lumiel.textContent.trim() : '';
  });

  const tempweather = await page.evaluate(() => {
  	const tempel = document.querySelector("#todayDetails > section > div.TodayDetailsCard--hero--2QGgO > div.TodayDetailsCard--feelsLikeTemp--2x1SW > span.TodayDetailsCard--feelsLikeTempValue--2icPt")
  	return tempel ? tempel.textContent.trim() : '';
  });

  const t = tempweather.replace(/°/g, '');
  const l = lumiweather.match(/\d+/g).join("");

  currenttemperature = parseInt(t);
  currentluminosity = parseInt(l);

  await browser.close();

  const medidatemp = { sensor: 'temperature', value: currenttemperature, timestamp: new Date() };
  const medidalum = { sensor: 'luminosity', value: currentluminosity, timestamp: new Date() };

  console.log('Nueva medida recibida:', medidatemp);
  console.log('NUeva medida recibida:', medidalum);

  db.collection('measurements').insertOne(medidatemp);
  db.collection('measurements').insertOne(medidalum);

  agent.handleMessage();

}

// Actualización de la temperatura y la luminosidad
setInterval(() => {
  getWeather();

  // Emitir evento actuatorStatusUpdate con el nuevo estado de los aparatos
  io.emit('sensorStatusUpdate', { temperature: currenttemperature, luminosity: currentluminosity });



}, 20000); // Ejecutar cada 20 segundos

// Variables para almacenar el estado de los aparatos
let blindsState = 'Subida';
let acState = 'Apagado';
let currenttemperature = 0;
let currentluminosity = 0;

// Crear el agente de control
const agent = {
  temperatureThreshold: 35, // Umbral de temperatura
  brightnessThreshold: 1000, // Umbral de luminosidad
  handleMessage: function () {
    if (currenttemperature > this.temperatureThreshold && currentluminosity > this.brightnessThreshold) {
      // Ambos umbrales superados, bajar la persiana
      if (blindsState !== 'Bajada') {
        blindsState = 'Bajada';
        console.log('Persiana bajada debido a que se superaron los umbrales de temperatura y luminosidad');
        // Guardar el registro en la base de datos
        db.collection('actions').insertOne({ device: 'persiana', state: blindsState, timestamp: new Date() });
        // Transmitir la acción a los clientes
        io.emit('action', { device: 'persiana', state: blindsState });
      }
    }
  }
};

// Ruta para la página de clientes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/client.html');
});

// Ruta para la página de administrador
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Configurar eventos de Socket.IO para la comunicación con los clientes
io.on('connection', (client) => {
  console.log('Cliente conectado:', client.id);
  // Enviar el estado actual de los sensores al cliente
  client.emit('sensorStatusUpdate', { temperature: currenttemperature, luminosity: currentluminosity });

  // Enviar el estado actual de los aparatos al cliente
  client.emit('actuatorStatusUpdate', { blinds: blindsState === 'Bajada', ac: acState === 'Encendido' });

  // Escuchar evento de cambio de medidas de los sensores
  client.on('newMeasurement', (measurement) => {
    console.log('Nueva medida recibida:', measurement);

    // Guardar la medida en la base de datos
    db.collection('measurements').insertOne(measurement);

    if(measurement.sensor === 'temperature'){
      currenttemperature = measurement.value;
    }

    if(measurement.sensor === 'luminosity'){
      currentluminosity = measurement.value;
    }

    // Enviar la medida al agente de control
    agent.handleMessage();

    // Transmitir la medida a los clientes
    io.emit('measurementUpdate', measurement);

  });

  // Escuchar evento de acción en los aparatos
  client.on('action', (action) => {
    console.log('Acción recibida (subiendo tweet):', action);
    subirTweet();

    // Actualizar el estado de los aparatos según la acción recibida
    if (action.device === 'persiana') {
      blindsState = action.state;
      console.log('Estado de la persiana actualizado:', blindsState);
      // Guardar el registro en la base de datos
      db.collection('actions').insertOne({ device: 'persiana', state: blindsState, timestamp: new Date() });
    } else if (action.device === 'aire') {
      acState = action.state;
      console.log('Estado del aire acondicionado actualizado:', acState);
      // Guardar el registro en la base de datos
      db.collection('actions').insertOne({ device: 'aire', state: acState, timestamp: new Date() });
    }

    // Transmitir la acción a los clientes
    io.emit('action', action);
  });

  // Escuchar evento de desconexión del cliente
  client.on('disconnect', () => {
    console.log('Cliente desconectado:', client.id);
  });

});

// Iniciar el servidor
const port = 8080;
server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

