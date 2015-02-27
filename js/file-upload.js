$(document).ready(function () {

	if (window.File && window.FileReader) {
		$('#uploadButton').click(startUpload);
		$('#fileBox').change(fileChosen);
		$('#uploadArea').append($('<p/>').text("Your browser supports the file API."));
	} else {
		$('#uploadArea').html("Your browser doesn't support the file API. Please update your browser.");
	}

	var selectedFile;
	function fileChosen(evt) {
		selectedFile = evt.target.files[0];
		$('#nameBox').val(selectedFile.name);
	}

	var socket = io.connect();

	var fileReader;
	var name;

	socket.on('moreData', function (data) {
		updateBar(data['percent'], data['rate'], data['downloaded']);
		var place = data['place'] * 524288; // the next block's starting position
		// the variable that will hold the new block of data
		var newFile;
		if (selectedFile.slice)
			newFile = selectedFile.slice(place, place + Math.min(524288, (selectedFile.size - place)));
		else
			alert('slice method doesn\'t exist !');
		fileReader.readAsBinaryString(newFile);
	});
	socket.on('done', function (data) {
		$('#uploadArea').empty();
		$('#uploadArea').append($('<p/>').text("Nom du fichier: " + data.name));
		$('#uploadArea').append($('<p/>').text("Taille du fichier (Mo): " + data.size));
		$('#uploadArea').append($('<p/>').text("Téléchargé (Mo): " + data.downloaded));
		$('#uploadArea').append($('<p/>').text("Date de début: " + data.startDate));
		$('#uploadArea').append($('<p/>').text("Date de fin: " + data.finishDate));
		$('#uploadArea').append($('<p/>').text("Temps écoulé (ms): " + data.elapsedTime));
		$('#uploadArea').append($('<p/>').text("Taux de transfert (Mo/s): " + data.rate));
	});
	socket.on('error', function (err) {
		$('body').append($('<p/>').text(err));
	});

	var uploading = false;
	function startUpload() {
		if ($('#fileBox').val() != '') {
			uploading = true;
			fileReader = new FileReader();
			name = $('#nameBox').val();
			$('#uploadArea').empty();
			$('#uploadArea').append("<span id='nameArea'>Uploading " + selectedFile.name + " as " + name + "</span>");
			$('#uploadArea').append("<div id='rate'></div>");
			$('#uploadArea').append("<div id='progressContainer'><div id='progressBar'></div></div><span id='percent'>0%</span>");
			$('#uploadArea').append("<span id='uploaded'> - <span id='MB'>0</span>/" + toRoundedMegaByte(selectedFile.size) + "MB</span>");
			$('#uploadArea').append("<button id='pause-upload' type='button' class='Button'>Pause</button>");
			$('#uploadArea').append("<button id='resume-upload' type='button' class='Button'>Resume</button>");
			$('#uploadArea').append("<button id='cancel-upload' type='button' class='Button'>Cancel</button>");

			fileReader.onload = function (evt) {
				socket.emit('upload', {
					'name' : name,
					'data' : evt.target.result
				});
			}
			socket.emit('start', {
				'name' : name,
				'size' : selectedFile.size
			});

			$('#resume-upload').hide();
			$('#pause-upload').click(function () {
				console.log('pausing upload!');
				socket.emit('pause', {
					'name' : name
				});
				$(this).hide();
				$('#resume-upload').show();
			});
			$('#resume-upload').click(function () {
				console.log('resuming upload!');
				socket.emit('resume', {
					'name' : name
				});
				$(this).hide();
				$('#pause-upload').show();
			});
			$('#cancel-upload').click(function () {
				console.log('cancelling upload!');
				socket.emit('cancel', {
					'name' : name
				});
				
				$(this).hide();
				$('#resume-upload').hide();
				$('#pause-upload').hide();
				$('body').append($('<p/>').text('The file upload has been cancelled.'));
			});
		} else {
			alert('Selected a file');
		}
	}
	function toRoundedMegaByte(val) {
		return Math.round(val / (1024 * 1024));
	}
	function updateBar(percent, rate, downloaded) {
		$('#progressBar').attr('style', 'width = ' + percent + '%');
		$('#percent').html(Math.round(percent * 100) / 100 + '%');
		$('#MB').html(downloaded);
		$('#rate').html(rate + ' Mo/s');
	}
});
