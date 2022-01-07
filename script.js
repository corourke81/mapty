'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10); // never do this in the real world, quick id

  // The common characteristics of running and cycling workouts are initialized by running constructor
  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    // 'type' is running or cycling, see subclasses of Workout
    // this.date.getMonth() between 0 and 11
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  // The four characteristics of running workout are initialized by running constructor, along with pace and description
  constructor(coords, distance, duration, cadence) {
    // inherited from Workout, common to running and cycling
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription(); // method marked as private
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

// Cycling class similar to Running class
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map; // Will be our map
  #mapZoomLevel = 13; // How high above ground
  #mapEvent; // Will be point on map
  #workouts = []; // Will stores details of workouts

  constructor() {
    this._getPosition();
    this._getLocalStorage(); // Workouts are stored if app is closed
    // Submission of workout form, bound 'this' is App
    form.addEventListener('submit', this._newWorkout.bind(this));
    // Change from running to cycling, vice-versa
    inputType.addEventListener('change', this._toggleElevationField);
    // Click on workout, move to pin
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  // Loads map if current position can be found, otherwise displays error message
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this), // Bound 'this' is App, _loadMap called with geolocation
        function () {
          alert('Could not get your location');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords; // Equivalent to: const latitude = position.coords.latitude
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    // Specifies a map with calculated coordinates (centre) and height above ground
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    // Configures map for display
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // When the map is clicked, show the form, _showForm is called with position of click
    this.#map.on('click', this._showForm.bind(this));

    // When the app updates, render a marker for each workout
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  // To show form, remove hidden class and move cursor to distance field
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  // To hide form, reset values and add hidden class
  _hideForm() {
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    // Fade out
    setTimeout(function () {
      form.style.display = 'grid';
    }, 1000);
  }

  // Switch between elevation and cadence (on 'change' event)
  _toggleElevationField() {
    // Closest ancestor of inputElevation that matches selector is toggled
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault(); // Needed, as there is a form for each new workout

    // Function that takes any number of values as input (converts to array), returns true if EVERY value is a number
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    // Returns true if EVERY input value is positive
    const arePositive = (...inputs) => inputs.every(inp => inp > 0);

    // Stores the form's input values
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    if (type === 'running') {
      // Stores cadence, specific to running
      const cadence = +inputCadence.value;
      // If invalid input
      if (
        !validInputs(distance, duration, cadence) ||
        !arePositive(distance, duration, cadence)
      )
        return alert('Please enter a positive number');

      // If input is valid, workout is an instance of Running class, run constructor
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // Similar to 'type === 'running''
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !arePositive(distance, duration)
      )
        return alert('Please enter a positive number (except for elevation)');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add workout to workouts array
    this.#workouts.push(workout);

    this._renderWorkout(workout);

    this._renderWorkoutMarker(workout);

    // Once workout is added, hide form
    this._hideForm();

    this._setLocalStorage();
  }

  // Renders workout marker at point of initial click
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`, // Different styles
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  // Renders an individual workout. All workouts are rendered by running _getLocalStorage(). Displays characteristics of workout. 
  _renderWorkout(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance.toFixed(1)}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running') {
      html += `<div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
  </li>`;
    }

    if (workout.type === 'cycling') {
      html += `<div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>`;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  // On clicking workout, move to pop-up
  _moveToPopup(e) {
    // workoutEl is closest parent of e.target that matches the selector
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    // If a workout was clicked, find the workout in array with the same id  
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id // <-- id of clicked workout
    );

    // Then with this workout's coordinates, pan to popup
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  // Store all workouts
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  // Retrieves workouts. If there are any, render each
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }
}
// Create instance of App class
const app = new App();
