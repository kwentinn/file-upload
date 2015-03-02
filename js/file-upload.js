$(document).ready(function () {

	if (window.File && window.FileReader) {
		$('#uploadButton').click(startUpload);
		$('#fileBox').change(fileChosen);
		$('#uploadInfo').html($('<p/>').text("Your browser supports the file API."));

		var fr = new FileReader();
		if (!fr.readAsBinaryString) {
			$('#uploadInfo').html($('<p/>').text('The fileReader.readAsBinaryString method is unavilable !'));
			$('#uploadInfo').append($('<p/>').text('Please upgrade your browser or use another one.'));
			$('#uploadArea').hide();
		}
		fr = null;
	} else {
		$('#uploadArea').hide();
		$('#uploadInfo').html("Your browser doesn't support the file API. Please update your browser.");
	}

	var selectedFile;
	function fileChosen(evt) {
		selectedFile = evt.target.files[0];
		$('#nameBox').val(selectedFile.name);
		if (!selectedFile.slice)
			console.log('KO: slice method unavailable...');
		else
			console.log('OK: slice method available.');
	}

	var socket = io.connect();

	var fileReader;
	var name;

	socket.on('moreData', function (data) {
		//La variable BLOCK_SIZE est définie dans app.js et passée en param au template ejs.
		updateBar(data['percent'], data['rate'], data['downloaded']);
		var start = data['place'] * BLOCK_SIZE; // the next block's starting position
		// the variable that will hold the new block of data
		var newFile;
		if (selectedFile.slice) {
			var end = start + Math.min(BLOCK_SIZE, (selectedFile.size - start));
			newFile = selectedFile.slice(start, end);
			console.dir(data);
			console.log("start: " + start + ", Math.min(524288, (selectedFile.size - start)): " + Math.min(BLOCK_SIZE, (selectedFile.size - start)));
			console.log("start + Math.min(524288, (selectedFile.size - start)): " + end);
		} else
			alert('slice method doesn\'t exist !');
		fileReader.readAsBinaryString(newFile);

	});
	socket.on('done', function (data) {
		$('#uploadArea').show();
		$('#uploadInfo').html($('<p/>').text("Nom du fichier: " + data.name));
		$('#uploadInfo').append($('<p/>').text("Taille du fichier (Mo): " + data.size));
		$('#uploadInfo').append($('<p/>').text("Téléchargé (Mo): " + data.downloaded));
		$('#uploadInfo').append($('<p/>').text("Date de début: " + data.startDate));
		$('#uploadInfo').append($('<p/>').text("Date de fin: " + data.finishDate));
		$('#uploadInfo').append($('<p/>').text("Temps écoulé (ms): " + data.elapsedTime));
		$('#uploadInfo').append($('<p/>').text("Taux de transfert (Mo/s): " + data.rate));

		// reset des inputs
		$('#fileBox').val('');
		$('#nameBox').val('');
	});
	socket.on('error', function (err) {
		$('body').append($('<p/>').text(err));
	});

	var uploading = false;
	function startUpload() {
		if ($('#fileBox').val() != '') {
			fileReader = new FileReader();
			uploading = true;
			name = $('#nameBox').val();
			$('#uploadArea').hide();
			$('#uploadInfo').html("<span id='nameArea'>Uploading " + selectedFile.name + " as " + name + "</span>");
			$('#uploadInfo').append("<div id='rate'></div>");
			$('#uploadInfo').append("<div id='progressContainer'><div id='progressBar'></div></div><span id='percent'>0%</span>");
			$('#uploadInfo').append("<span id='uploaded'> - <span id='MB'>0</span>/" + toRoundedMegaByte(selectedFile.size) + "MB</span>");
			$('#uploadInfo').append("<div><span><button id='pause-upload' type='button' class='Button'>Pause</button>");
			$('#uploadInfo').append("<button id='resume-upload' type='button' class='Button'>Resume</button>");
			$('#uploadInfo').append("<button id='cancel-upload' type='button' class='Button'>Cancel</button></span></div>");

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
				$('#uploadInfo').append($('<p/>').text('The file upload has been cancelled.'));
				$('#uploadArea').show();
				$('#fileBox').val('');
				$('#nameBox').val('');
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

	$(":file").filestyle();
});
