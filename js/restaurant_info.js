let restaurant;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
}
/*
 * fetch reviews
 */
fetchReviews = () => {
  const id = getParameterByName('id');
  if (!id) {
    console.log('No ID in URL');
    return;
  }
  DBHelper.fetchReviewsForRestaurant(id, (err, reviews) => {
  //  self.reviews = reviews;
  self.restaurant.reviews = reviews;
    if (err || !reviews) {
      console.log('reviews fetch error', err);
      return;
    }
    fillReviewsHTML();
  });
}
/*
 * set favorite button
 */
setFavoriteButton = (status) => {
  const favorite = document.getElementById('favBtn');
  if (status === 'true') {
    favorite.title = 'Restaurant is Favorite';
    favorite.innerHTML = '⭐️ Mark as Unfavorite';
  } else {
    favorite.title = 'Restaurant is not Favorite';
    favorite.innerHTML = '☆ Mark as Favorite';
  }
}
/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
// favorite
setFavoriteButton(restaurant.is_favorite);

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
 image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.srcset = DBHelper.imageSetUrlForRestaurant(restaurant); 
 image.alt = restaurant.name + restaurant.photoDescription;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  //fillReviewsHTML();
   fetchReviews();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}
formatDate = (ts) => {
  let date = new Date(ts);
  return date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
}
/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'reviewerName';
  li.appendChild(name);

  // const date = document.createElement('p');
  // date.innerHTML = review.date;
  // date.className = 'date';
  // li.appendChild(date);

  const date = document.createElement('p');
  date.innerHTML = formatDate(review.createdAt);
  date.className ='dateReview';
  li.appendChild(date)

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'rating';
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'comments';
  li.appendChild(comments);

  return li;
}

/*** Reviews ***/
navigator.serviceWorker.ready.then(function (swRegistration) {
  let form = document.querySelector('#review-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let rating = form.querySelector('#rating');
    let review = {
      restaurant_id: getParameterByName('id'),
      name: form.querySelector('#name').value,
      rating: rating.options[rating.selectedIndex].value,
      comments: form.querySelector('#comment').value
    };
    DBHelper.openDatabase().then(function(db){
      var transaction = db.transaction('outbox', 'readwrite');
      return transaction.objectStore('outbox').put(review);
     
    }).then(function () {
      if (navigator.onLine){
      const ul = document.getElementById('reviews-list');
      review.createdAt = new Date(); 
        ul.appendChild(createReviewHTML(review));
      }
      form.reset();
      return swRegistration.sync.register('sync').then(() => {
        console.log('Sync registered');
      });
    });
  });
});

/*** Favorites ***/
navigator.serviceWorker.ready.then(function (swRegistration) {
  let btn = document.getElementById('favBtn');
  btn.addEventListener('click', e => {
    const opposite = (self.restaurant.is_favorite === 'true') ? 'false' : 'true';
    let res = {
      resId: getParameterByName('id'),
      favorite: opposite
    };
    DBHelper.openDatabase().then(function(db){
      var transaction = db.transaction('favorite', 'readwrite');
      return transaction.objectStore('favorite').put(res);
    }).then(function () {
      setFavoriteButton(opposite);
      self.restaurant.is_favorite = opposite;
      return swRegistration.sync.register('favorite').then(() => {
        console.log('Favorite Sync registered');
      });
    });
  });
});

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
